const axios = require('axios');
const {CompositeDisposable, Disposable} = require('via');
const Websocket = require('./websocket');
const base = 'https://poloniex.com/public';
const Timeframes = [3e5, 9e5, 18e5, 72e5, 144e5, 864e5];

class PoloniexAdapter {
    constructor(){
        this.maxCandlesFromRequest = 500;
        this.resolution = 60000;
    }

    activate(){
        this.disposables = new CompositeDisposable();
        this.websocket = new Websocket();
    }

    deactivate(){
        //TODO Unregister the symbols (i.e. set their ready states to inactive)
        this.websocket.destroy();
        this.disposables.dispose();
        this.disposables = null;
    }

    title(){
        return 'Poloniex';
    }

    matches(symbol, callback){
        return this.websocket.subscribe(symbol.metadata.id, events => {
            for(const e of events){
                if(e[0] === 't'){
                    callback({
                        date: new Date(parseInt(e[5]) * 1000),
                        size: parseFloat(e[4]),
                        price: parseFloat(e[3]),
                        side: (e[2] === 1) ? 'buy' : 'sell',
                        id: e[1]
                    });
                }
            }
        });
    }

    ticker(symbol, callback){
        return this.matches(symbol, callback);
    }

    orderbook(symbol, callback){
        return this.websocket.subscribe(symbol.metadata.id, events => {
            const changes = [];

            for(const e of events){
                const [type] = e;

                if(type === 'i'){
                    const [asks, bids] = e[1].orderBook;
                    callback({type: 'snapshot', bids: Object.entries(bids), asks: Object.entries(asks)});
                }else if(type === 'o'){
                    const side = e[1] === 1 ? 'buy' : 'sell';
                    changes.push([side, e[2], e[3]]);
                }
            }

            if(changes.length){
                //Batch changes until the end, rather than updating the book one change at a time
                callback({type: 'update', changes});
            }
        });
    }

    history(symbol){
        const params = {
            command: 'returnTradeHistory',
            currencyPair: symbol.name.split('-').join('_')
        };

        return axios.get(base, {params})
        .then(response => response.data.map(datum => {
            return {
                date: new Date(datum.date),
                id: datum.globalTradeID,
                price: parseFloat(datum.rate),
                size: parseFloat(datum.amount),
                side: datum.type
            };
        }));
    }

    data({symbol, granularity, start, end}){
        if(!Timeframes.includes(granularity)){
            //TODO, eventually implement a method to allow for a wider variety of time frames
            throw new Error(`Invalid timeframe requested: ${granularity}`);
        }

        const params = {
            command: 'returnChartData',
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
            period: granularity / 1000,
            currencyPair: symbol.name.split('-').join('_')
        };

        return axios.get(base, {params})
        .then(response => response.data.map(({date, open, high, low, close, volume}) => {
            return {date: new Date(date * 1000), low, high, open, close, volume};
        }));
    }
}

module.exports = new PoloniexAdapter();
