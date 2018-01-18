const Helpers = require('./helpers');
const {CompositeDisposable, Disposable} = require('via');

module.exports = class Fill {
    constructor(fill){
        this.id = fill.trade_id;
        this.order = fill.order;
        this.side = fill.side;
        this.settled = fill.settled;
        this.created = new Date(fill.created_at);
        this.status = fill.status;
        this.size = parseFloat(fill.size);
        this.price = parseFloat(fill.price);
        this.fee = parseFloat(fill.fee);
        this.product = fill.product_id;
        this.maker = (fill.liquidity === 'M');
    }
}
