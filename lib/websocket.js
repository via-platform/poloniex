const Socket = require('ws');
const {CompositeDisposable, Disposable, Emitter} = require('via');
const uri = 'wss://api2.poloniex.com';

const channels = {
    ticker: 1002,
    heartbeat: 1010
};

module.exports = class Websocket {
    constructor(options = {}){
        this.status = 'disconnected';
        this.channels = new Map();
        this.connection = null;
        this.session = null;
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.interval = null;
        this.opened = false;

        return this;
    }

    connect(){
        if(!this.connection){
            this.connection = new Socket(uri);
            this.connection.on('message', this.message.bind(this));
            this.connection.on('open', this.open.bind(this));
            this.connection.on('close', this.close.bind(this));
            this.connection.on('error', this.error.bind(this));
        }
    }

    disconnect(){
        if(this.connection){
            this.connection.close();
            this.opened = false;
            console.log('closed');
        }
    }

    open(){
        this.interval = setInterval(this.heartbeat.bind(this), 30000);
        this.emitter.emit('did-open');
        this.opened = true;

        for(const channel of this.channels.keys()){
            this.send({command: 'subscribe', channel});
        }
    }

    send(data){
        if(this.opened){
            this.connection.send(JSON.stringify(data));
        }
    }

    close(){
        this.connection = null;
        this.session = null;
        this.opened = false;
        this.emitter.emit('did-close');
    }

    message(data){
        const message = JSON.parse(data);
        const [channel, id, events] = message;

        if(this.channels.has(channel)){
            const subscriptions = this.channels.get(channel);

            for(let subscription of subscriptions){
                subscription(events);
            }
        }
    }

    heartbeat(){
        if(this.connection){
            this.connection.send('.');
        }
    }

    error(){
        console.error('Error');
    }

    subscribe(channel, callback){
        this.connect();

        if(this.channels.has(channel)){
            this.channels.get(channel).push(callback);
        }else{
            this.channels.set(channel, [callback]);

            if(this.session){
                //Subscribe if we're already connected, otherwise this.open will handle the subscription process
                this.send({command: 'subscribe', channel});
            }
        }

        return new Disposable(() => this.unsubscribe(channel, callback));
    }

    unsubscribe(channel, callback){
        if(this.channels.has(channel)){
            const listeners = this.channels.get(channel);
            listeners.splice(listeners.indexOf(callback), 1);

            if(!listeners.length){
                this.channels.delete(channel);
                this.emitter.emit('did-close', channel);
            }
        }

        if(!this.channels.size){
            this.disconnect();
        }
    }

    destroy(){
        this.disconnect();
        this.disposables.dispose();
        this.emitter.emit('did-destroy');
        this.emitter = null;
    }
}
