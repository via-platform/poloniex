const axios = require('axios');
const {CompositeDisposable, Disposable} = require('via');
const Websocket = require('./websocket');
const Symbol = require('./symbol');

class Poloniex {
    constructor(){}

    async activate(){
        this.disposables = new CompositeDisposable();
        this.websocket = new Websocket();

        const symbols = await Symbol.all();

        for(const [name, symbol] of Object.entries(symbols)){
            this.disposables.add(via.symbols.add(new Symbol(name, symbol, this.websocket)));
        }

        const accounts = await via.accounts.loadAccountsFromStorage('poloniex');

        for(const account of accounts){
            this.disposables.add(via.accounts.activate(new Account(account, this.websocket)));
        }
    }

    deactivate(){
        this.websocket.destroy();
        this.disposables.dispose();
        this.disposables = null;
    }

    async account(config){
        const account = await via.accounts.add({name: config.accountName, exchange: 'poloniex', key: Helpers.key(config)});
        this.disposables.add(via.accounts.activate(new Account(account, this.websocket)));
    }

    title(){
        return 'Poloniex';
    }
}

module.exports = new Poloniex();
