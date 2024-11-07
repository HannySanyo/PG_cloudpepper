/** pos_order_update.js */
function updateCustomerDisplay() {
    const order = posModel.get_order(); // Assuming posModel is accessible
    if (order) {
        const total = order.get_total_with_tax();
        const salesTax = order.get_total_tax();

        // Send message via BroadcastChannel for the customer display
        new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY").postMessage({
            total: total,
            salesTax: salesTax
        });
    }
}

// Listen to relevant POS order events
posbus.on("new_order", null, updateCustomerDisplay);
posbus.on("update_order", null, updateCustomerDisplay);