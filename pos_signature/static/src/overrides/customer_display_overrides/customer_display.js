/** customer_display.js */
import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { batched } from "@web/core/utils/timing";
import { effect } from "@web/core/utils/reactive";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        // Initialize state with placeholders for order total and sales tax
        this.state = useState({
            signature: '',
            total: 0,       // Order total
            salesTax: 0,    // Sales tax
        });

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Listen for messages on the BroadcastChannel
        this.customerDisplayChannel.onmessage = (event) => {
            const data = event.data;
            // Set the total and sales tax from the received data
            this.state.total = data.total || 0;
            this.state.salesTax = data.salesTax || 0;  // Capture sales tax if available
        };

        // Reactive effect for signature submission
        effect(
            batched(() => {
                if (this.state.signature) {
                    this.sendSignatureData(this.state.signature);
                }
            })
        );

        this.drawing = false;
    },

    // Getter for formatted total amount
    get orderTotal() {
        return this.state.total.toFixed(2);
    },

    // Getter for formatted sales tax amount
    get salesTax() {
        return this.state.salesTax.toFixed(2);
    },

    // Method to clear the signature canvas
    onClickClear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    // Drawing and signature capture methods (unchanged)
    getPosition(event) { /*...*/ },
    startDrawing(event) { /*...*/ },
    stopDrawing() { /*...*/ },
    draw(event) { /*...*/ },

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

    // Capture the signature data from the canvas
    onSubmitSignature() {
        this.state.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    },
});
