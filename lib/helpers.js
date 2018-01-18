const crypto = require('crypto');
const axios = require('axios');
const url = 'https://poloniex.com/public';

const Helpers = {
    timeframes: [3e5, 9e5, 18e5, 72e5, 144e5, 864e5],
    key: config => {
        if(!config.apiKey || !config.apiSecret){
            throw new Error('Missing a required parameter. API key and secret are both required fields.');
        }

        return JSON.stringify([config.apiKey, config.apiSecret]);
    },
    // sign: ({key, secret}, data = {}) => {
    //     data.timestamp = Date.now();
    //     const query = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    //     data.signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
    //
    //     return data;
    // },
    // request: (keys, method, path, data) => {
    //     const signed = Helpers.sign(keys, data);
    //
    //     return axios({
    //         method,
    //         url: url + path,
    //         params: signed,
    //         headers: {
    //             'X-MBX-APIKEY': keys.key
    //         }
    //     });
    // },
    // status: status => {
    //     if(['NEW', 'PARTIALLY_FILLED'].includes(status)){
    //         return 'working';
    //     }
    //
    //     return status.toLowerCase();
    // },
    data: d => ({date: new Date(d.date * 1000), open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close), volume: parseFloat(d.quoteVolume)}),
    // position: d => ({balance: parseFloat(d.balance), hold: parseFloat(d.hold)}),
    match: d => ({id: d[1], date: new Date(parseInt(d[5]) * 1000), price: parseFloat(d[3]), size: parseFloat(d[4]), side: (d[2] === 1) ? 'buy' : 'sell'}),
    history: d => ({date: new Date(d.date), price: parseFloat(d.rate), size: parseFloat(d.amount), side: d.type, id: d.globalTradeID}),
    symbol: id => via.symbols.findByExchange('poloniex').filter(s => s.id === id)
};

module.exports = Helpers;
