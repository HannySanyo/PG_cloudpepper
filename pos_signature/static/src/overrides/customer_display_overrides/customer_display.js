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

        // Initializing state with simple numeric values only
        this.state = useState({
            signature: '',
            total: 0,
            salesTax: 0,
        });

        // Calculate total and sales tax initially and on updates
        effect(batched(() => {
            this.state.total = this.calculateTotalWithTax();
            this.state.salesTax = this.calculateTotalTax();
        }));

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature  = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        effect(
            batched(
                ({ signature }) => {
                    if (!signature) {
                        return;
                    }
                    this.sendSignatureData(signature);
                }
            ),
            [this.state]
        );

        this.drawing = false;
    },

    // Helper method to calculate total with tax (returns a numeric value)
    calculateTotalWithTax() {
        let total = 0;
        if (this.order && this.order.orderlines) {
            this.order.orderlines.each(line => {
                total += line.get_price_with_tax(); // Assuming get_price_with_tax() exists for each line
            });
        }
        return total;
    },

    // Helper method to calculate total tax (returns a numeric value)
    calculateTotalTax() {
        let tax = 0;
        if (this.order && this.order.orderlines) {
            this.order.orderlines.each(line => {
                tax += line.get_tax(); // Assuming get_tax() exists for each line
            });
        }
        return tax;
    },

    onClickClear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    getPosition(event) {
        const canvas = this.my_canvas.el;
        this.ctx = canvas.getContext('2d');
        this.ctx.lineWidth = 1.7;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#222222';
        this.ctx.lineJoin = 'round';
        this.signature_done = false;
        this.lastX = 0;
        this.lastY = 0;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let x, y;
        if (event.type.includes('touch')) {
            const touch = event.touches[0];
            x = (touch.clientX - rect.left) * scaleX;
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            x = (event.clientX - rect.left) * scaleX;
            y = (event.clientY - rect.top) * scaleY;
        }

        return { x, y };
    },

    startDrawing(event) {
        this.drawing = true;
        const { x, y } = this.getPosition(event);
        [this.lastX, this.lastY] = [x, y];
    },

    stopDrawing() {
        this.drawing = false;
        this.ctx?.beginPath();
    },

    draw(event) {
        if (!this.drawing) return;

        const { x, y } = this.getPosition(event);
        this.signature_done = true;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);

        [this.lastX, this.lastY] = [x, y];
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
