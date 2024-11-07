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

        // Initialize state with placeholders for signature and sales tax
        this.state = useState({
            signature: '',
            salesTax: 0  // Placeholder for sales tax
        });

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Listen for messages on the BroadcastChannel to capture signature and sales tax data
        this.customerDisplayChannel.onmessage = (event) => {
            const data = event.data;
            if (data.signature) {
                this.state.signature = data.signature;
            }
            if (data.salesTax) {
                this.state.salesTax = data.salesTax;  // Update sales tax if present
            }
        };

        // Reactive effect for signature submission
        effect(
            batched(({ signature }) => {
                if (!signature) return;
                this.sendSignatureData(signature);
            }),
            [this.state]
        );

        this.drawing = false;
    },

    onClickClear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    getPosition(event) { /* Existing code */ },
    startDrawing(event) { /* Existing code */ },
    stopDrawing() { /* Existing code */ },
    draw(event) { /* Existing code */ },

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
