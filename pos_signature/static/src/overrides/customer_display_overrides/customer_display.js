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

        // Initialize the reactive state for signature and sales tax display
        this.state = useState({
            signature: '',
            salesTaxDisplay: '0.00'  // Default sales tax display
        });

        // Set up required services and references
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Load initial sales tax from localStorage
        this.loadSalesTaxFromLocalStorage();

        // Listen for tax updates from POS through BroadcastChannel
        this.customerDisplayChannel.onmessage = (event) => {
            if (event.data && event.data.sales_tax !== undefined) {
                console.log("Received sales tax update from POS:", event.data.sales_tax);
                this.updateSalesTaxDisplay(event.data.sales_tax);
            }
        };

        // Automatically send signature data if updated
        effect(
            batched(({ signature }) => {
                if (signature) {
                    this.sendSignatureData(signature);
                }
            }),
            [this.state]
        );

        this.drawing = false;
    },

    // Method to load sales tax from localStorage and update the display
    loadSalesTaxFromLocalStorage() {
        const taxData = localStorage.getItem('customerDisplayTaxData');
        if (taxData) {
            try {
                const parsedTaxData = JSON.parse(taxData);
                if (parsedTaxData.sales_tax !== undefined) {
                    console.log("Loaded initial sales tax from localStorage:", parsedTaxData.sales_tax);
                    this.updateSalesTaxDisplay(parsedTaxData.sales_tax);
                }
            } catch (error) {
                console.error("Failed to parse sales tax data from localStorage:", error);
            }
        }
    },

    // Method to update the sales tax display
    updateSalesTaxDisplay(tax) {
        this.state.salesTaxDisplay = parseFloat(tax).toFixed(2);
        console.log("Updated sales tax display:", this.state.salesTaxDisplay);
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

        // Adjust coordinates based on canvas scale
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
        this.ctx?.beginPath(); // Reset the path to avoid connecting lines between strokes
    },

    // Draw on the canvas
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
        }
        if (this.session.type === "remote") {
            await rpc(`/pos-customer-display/${this.session.config_id}`, {
                access_token: this.session.access_token,
                signature: this.state.signature || false,
            });
        }
    },

    onSubmitSignature() {
        this.state.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});