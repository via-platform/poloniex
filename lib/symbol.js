const {Emitter, CompositeDisposable} = require('via');
const axios = require('axios');

const Helpers = require('./helpers');
const url = 'https://poloniex.com/public';

module.exports = class Symbol {
    static all(){
        return axios.get(url, {params: {command: 'returnTicker'}}).then(response => response.data);
    }

    constructor(name, params, websocket){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.websocket = websocket;

        const [quote, base] = name.split('_');

        this.id = params.id;
        this.base = base;
        this.quote = quote;
        this.name = `${base}-${quote}`;
        this.exchange = 'poloniex';
        this.categories = ['Poloniex'];
        this.description = 'Poloniex';
        this.available = (params.isFrozen === '0');
        this.marginEnabled = false;

        this.identifier = 'POLONIEX:' + this.name;

        this.baseMinSize = 1e-8;
        this.baseMaxSize = 0;
        this.baseIncrement = 1e-8;
        this.basePrecision = 8;

        this.quoteMinPrice = 1e-8;
        this.quoteMaxPrice = 0;
        this.quoteIncrement = 1e-8;
        this.quotePrecision = 8;

        this.granularity = 60000; //Smallest candlestick size available
        this.precision = 8; //Number of decimal places to support
        this.minNotional = 0;

        this.aggregation = 2; //Number of decimal places to round to / group by for display purposes, minimum 2

        let last = parseFloat(params.last);

        while(!isNaN(last) && last > 0 && last < 1){
            this.aggregation++;
            last *= 10;
        }
    }

    data({granularity, start, end}){
        //TODO, eventually implement a method to allow for a wider variety of time frames
        if(!Helpers.timeframes.includes(granularity)) throw new Error('Invalid timeframe requested.');

        const params = {
            command: 'returnChartData',
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
            period: granularity / 1000,
            currencyPair: `${this.quote}_${this.base}`
        };

        return axios.get(url, {params}).then(response => response.data.map(Helpers.data));
    }

    history(){
        const params = {command: 'returnTradeHistory', currencyPair: `${this.quote}_${this.base}`};
        return axios.get(url, {params}).then(response => response.data.map(Helpers.history));
    }

    orderbook(callback){
        //Get the orderbook via an HTTP request and fire a snapshot event if we are still subscribed
        //TODO Check to make sure we're still subscribed before firing the callback to nowhere
        const queue = [];
        const params = {command: 'returnOrderBook', currencyPair: `${this.quote}_${this.base}`, depth: 1000};
        let loaded = false;

        axios.get(url, {params: {symbol: this.id}})
        .then(response => {
            if(loaded){
                return;
            }

            callback({type: 'snapshot', bids: response.data.bids, asks: response.data.asks})
            loaded = true;

            //TODO Apply any missed socket events
            //The issue here is that socket events from API V2 do not include a
            for(const e of queue){

            }
        })
        .catch(() => {}); //TODO Somehow handle this error

        return this.websocket.subscribe(this.id, events => {
            const changes = [];

            for(const e of events){
                const [type] = e;

                if(type === 'i'){
                    if(loaded){
                        return;
                    }

                    const [asks, bids] = e[1].orderBook;
                    callback({type: 'snapshot', bids: Object.entries(bids), asks: Object.entries(asks)});
                    loaded = true;
                }else if(type === 'o'){
                    const side = e[1] === 1 ? 'buy' : 'sell';

                    if(loaded){
                        changes.push([side, e[2], e[3]]);
                    }else{
                        queue.push([side, e[2], e[3]]);
                    }
                }
            }

            if(changes.length){
                //Batch changes until the end, rather than updating the book one change at a time
                callback({type: 'update', changes});
            }
        });
    }

    matches(callback){
        return this.websocket.subscribe(this.id, events => {
            for(const e of events){
                if(e[0] === 't'){
                    callback(Helpers.match(e));
                }
            }
        });
    }

    ticker(callback){
        return this.matches(callback);
    }
}
