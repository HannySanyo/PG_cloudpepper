import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { useRef, onWillUnmount } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        // Initialize state with total and salesTax as simple values
        this.state = useState({
            signature: '',
            total: 0,
            salesTax: 0,
        });

        // Service and canvas setup
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Attach to POS model events
        if (this.env.pos) {
            this.env.pos.on("new_order", this, this.handleOrderUpdate);
            this.env.pos.on("update_order", this, this.handleOrderUpdate);
        }

        onWillUnmount(() => {
            // Cleanup to avoid memory leaks
            if (this.env.pos) {
                this.env.pos.off("new_order", this, this.handleOrderUpdate);
                this.env.pos.off("update_order", this, this.handleOrderUpdate);
            }
        });

        this.drawing = false;
    },

    // Method to handle order updates and recalculate totals
    handleOrderUpdate() {
        const currentOrder = this.env.pos.get_order();
        if (currentOrder) {
            this.order = currentOrder;
            this.updateTotals();
        } else {
            console.warn("No current order available.");
        }
    },

    // Manually update total and sales tax
    updateTotals() {
        console.log("Updating totals...");
        this.state.total = this.calculateTotalWithTax();
        this.state.salesTax = this.calculateTotalTax();
    },

    // Helper method to calculate total with tax
    calculateTotalWithTax() {
        let total = 0;
        if (this.order && this.order.orderlines) {
            this.order.orderlines.each(line => {
                if (typeof line.get_price_with_tax === "function") {
                    total += line.get_price_with_tax();
                } else if (line.price_with_tax) {
                    total += line.price_with_tax;
                } else {
                    console.warn("Unable to get price with tax for line", line);
                }
            });
        }
        console.log("Calculated total with tax:", total);
        return total;
    },

    // Helper method to calculate total tax
    calculateTotalTax() {
        let tax = 0;
        if (this.order && this.order.orderlines) {
            this.order.orderlines.each(line => {
                if (typeof line.get_tax === "function") {
                    tax += line.get_tax();
                } else if (line.tax) {
                    tax += line.tax;
                } else {
                    console.warn("Unable to get tax for line", line);
                }
            });
        }
        console.log("Calculated total tax:", tax);
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
