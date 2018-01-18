const {CompositeDisposable, Disposable, Emitter} = require('via');
const Helpers = require('./helpers');
const Order = require('./order');
const axios = require('axios');
const _ = require('underscore-plus');

module.exports = class Account {
    constructor(params, websocket){
        const [key, secret] = JSON.parse(via.accounts.keys.get(params.uuid));

        this.keys = {key, secret};
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.websocket = websocket;
        this.uuid = params.uuid;
        this.name = params.name;
        this.exchange = 'binance';
        this.position = new Map();
        this.status = null;

        this.initialize();
    }

    initialize(){
        this.loadPosition();
        this.loadOrders();
        this.disposables.add(this.websocket.subscribe(this.keys.key, event => this.update(event)));
    }

    update(event){
        console.log(event);
        if(event.e === 'outboundAccountInfo'){
            //Update our balances and account status
            this.updateStatus(event.T ? 'active' : 'inactive');

            for(const {a, f, l} of Object.entries(event.B)){
                this.updatePosition(a, Helpers.position({balance: f, hold: l}));
            }
        }else if(event.e === 'executionReport'){
            //Handle a trade update
            let order = via.orders.find(event.id);

            if(order){
                // return order.lifecycle(event);
            }
        }
    }

    loadPosition(){
        return Helpers.request(this.keys, 'GET', '/api/v3/account')
        .then(response => {
            this.updateStatus(response.data.canTrade ? 'active' : 'inactive');

            for(const {asset, free, locked} of Object.entries(response.data.balances)){
                this.updatePosition(asset, Helpers.position({balance: free, hold: locked}));
            }
        })
        .catch(error => console.error(error));
    }

    loadOrders(){
        return Helpers.request(this.keys, 'GET', '/api/v3/openOrders')
        .then(response => {
            this.disposables.add(via.orders.add(response.data.map(o => new Order(o, this))));
        });
    }

    updateStatus(status){
        if(this.status !== status){
            this.status = status;
            this.emitter.emit('did-change-status', status);
        }
    }

    updatePosition(currency, position){
        if(!_.isEqual(position, this.position.get(currency))){
            this.position.set(currency, position);
            this.emitter.emit('did-update-position', {currency, position});
        }
    }

    destroy(){
        //TODO this method needs to be async, because we have to do shutdown processes / ask for confirmations
        //TODO this method may have to kill orders and stuff
        this.disposables.dispose();
    }
}
