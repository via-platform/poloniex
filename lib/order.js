const Helpers = require('./helpers');
const Fill = require('./fill');
const {CompositeDisposable, Disposable, Emitter} = require('via');
const axios = require('axios');
const UUID = require('uuid/v1');

module.exports = class Order {
    static received(event, account){
        return new Order({
            id: event.order_id,
            product_id: event.product_id,
            client_oid: event.client_oid,
            created_at: event.time,
            side: event.side,
            size: event.size,
            type: event.order_type,
            settled: false,
            status: 'received',
            price: event.price,
            filled_size: 0,
            fill_fees: 0,
            executed_value: 0
        }, account);
    }

    constructor(order, account){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.fills = new Map();

        this.id = order.id;
        this.uuid = order.clientOrderId || UUID();
        this.type = order.type.toLowerCase();
        this.side = order.side.toLowerCase();
        this.size = parseFloat(order.origQty);
        this.settled = order.status === 'FILLED';
        this.created = new Date(order.time);
        this.updated = new Date();
        this.status = Helpers.status(order.status);
        this.price = parseFloat(order.price);
        this.filled = parseFloat(order.executedQty);
        this.remaining = this.size - this.filled;
        this.fee = 0; //TODO we have to calculate this from the fills
        this.executed = 0; //TODO we have to calculate this from the fills
        this.tif = order.timeInForce.toLowerCase();
        this.iceberg = parseFloat(order.icebergQty);
        this.stop = parseFloat(order.stopPrice);

        this.account = account;
        this.symbol = Helpers.symbol(order.symbol);

        if(order.fills){
            for(const f of order.fills){
                this.fill(f);
            }
        }
    }

    fill(f){
        const fill = new Fill(f);
        this.fills.set(fill.id, fill);
        this.emitter.emit('did-update-fills', fill);
    }

    transmit(){
        //TODO ensure that this order has not yet been transmitted
        this.updateStatus('transmitting');
    }

    kill(){
        //TODO ask for confirmation based on user preference
        const previousStatus = this.status;

        this.emitter.emit('will-kill');
        this.updateStatus('killing');

        return Helpers.request(this.account.keys, 'DELETE', `/orders/${this.id}`)
            .then(() => this.updateStatus('killed'))
            .catch(error => {
                this.updateStatus(previousStatus);
                console.error('Could not kill this order.', error);
            });
    }

    done(event){
        const reason = (event.reason === 'filled') ? 'filled' : 'killed';
        this.remaining = parseFloat(event.remaining_size);
        this.updateStatus(reason);
    }

    lifecycle(event){
        //Handle a lifecycle event from the websocket
        switch(event.type){
            case 'received':
                this.updateStatus('received');
                break;
            case 'open':
                this.updateStatus('open');
                break;
            case 'done':
                this.done(event);
                break;
            case 'match':
                //Reload the fills from the server
                break;
        }

        this.emitter.emit('did-update');
    }

    updateStatus(status){
        if(this.status !== status){
            this.status = status;
            this.emitter.emit('did-update-status', status);
        }
    }

    destroy(){
        this.disposables.dispose();
    }

    onDidUpdateFills(callback){
        return this.emitter.on('did-update-fills', callback);
    }

    onWillKill(callback){
        return this.emitter.on('will-kill', callback);
    }

    onDidKill(callback){
        return this.emitter.on('did-kill', callback);
    }

    onDidUpdateStatus(callback){
        return this.emitter.on('did-update-status', callback);
    }

    onDidUpdate(callback){
        return this.emitter.on('did-update', callback);
    }
}
