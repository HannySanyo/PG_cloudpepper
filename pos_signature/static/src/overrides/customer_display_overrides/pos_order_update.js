/** pos_order_update.js */
function broadcastOrderUpdate() {
    const order = window.posmodel.get_order();
    if (order) {
        const total = order.get_total_with_tax();
        const salesTax = order.get_total_tax();

        // Broadcast order details to the customer display
        new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY").postMessage({
            total: total,
            salesTax: salesTax
        });
    }
}

// Attach listeners to the order model directly (e.g., after items are added/updated)
odoo.define('pos_signature.OrderListener', function(require) {
    const models = require('point_of_sale.models');
    
    const OrderSuper = models.Order;
    models.Order = OrderSuper.extend({
        initialize: function() {
            this._super.apply(this, arguments);
            this.on('change', this, broadcastOrderUpdate);
        },
    });
});
