import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { useRef, onWillUnmount, onMounted } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        // Initialize state with placeholders
        this.state = useState({
            signature: '',
            total: 50, // Placeholder for debugging
            salesTax: 10, // Placeholder for debugging
        });

        // Service and canvas setup
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Delayed access to POS model and event setup on mount
        onMounted(() => {
            if (this.env.pos) {
                console.log("POS environment found on mount");
                this.env.pos.on("new_order", this, this.handleOrderUpdate);
                this.env.pos.on("update_order", this, this.handleOrderUpdate);

                // Attempt to access current order now that we're mounted
                this.handleOrderUpdate();
            } else {
                console.warn("POS environment not found on mount");
            }
        });

        // Cleanup on unmount
        onWillUnmount(() => {
            if (this.env.pos) {
                this.env.pos.off("new_order", this, this.handleOrderUpdate);
                this.env.pos.off("update_order", this, this.handleOrderUpdate);
            }
        });

        this.drawing = false;
    },

    handleOrderUpdate() {
        const currentOrder = this.env.pos ? this.env.pos.get_order() : null;
        if (currentOrder) {
            this.order = currentOrder;
            console.log("Order updated:", this.order);  // Debugging log
            console.log("Orderlines:", this.order?.orderlines);  // Debugging log
            this.updateTotals();
        } else {
            console.warn("No current order available.");
        }
    },

    // Simplified updateTotals to hardcode placeholder values
    updateTotals() {
        this.state.total = 50; // Placeholder to check if rendering works
        this.state.salesTax = 10; // Placeholder to check if rendering works
        console.log("Setting placeholders. Total:", this.state.total, "Sales Tax:", this.state.salesTax);
    },

    onClickClear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    async sendSignatureData(signature) {
        if (this.session.type === "local") {
            this.customerDisplayChannel.postMessage({ test: 'test', signature: signature });
        } else if (this.session.type === "remote") {
            await rpc(
                `/pos-customer-display/${this.session.config_id}`,
                {
                    access_token: this.session.access_token,
                    signature: this.state.signature || false,
                }
            );
        }
    },

    onSubmitSignature() {
        this.state.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});
