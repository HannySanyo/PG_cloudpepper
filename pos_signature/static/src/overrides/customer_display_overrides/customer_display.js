import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { observe } from "@odoo/owl";  // Use observe instead of useState
import { batched } from "@web/core/utils/timing";
import { effect } from "@web/core/utils/reactive";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        // Define individual reactive properties with observe
        this.signature = observe({ value: '' });
        this.salesTaxDisplay = observe({ value: '0.00' });
        this.orderReady = observe({ value: false });

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature.value;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Effect for sending signature data when it changes
        effect(
            batched(() => {
                if (!this.signature.value) return;
                this.sendSignatureData(this.signature.value);
            }),
            [this.signature.value]  // Only react to changes in `signature.value`
        );

        this.drawing = false;

        // Check if the order is available; once available, set orderReady to true
        if (this.order && this.order.id) {
            this.orderReady.value = true;
        }

        // Load sales tax data when orderReady changes
        effect(() => {
            if (this.orderReady.value) {
                this.loadSalesTax();
            }
        });
    },

    async loadSalesTax() {
        try {
            const response = await fetch('/pos/get_sales_tax', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: { id: this.order.id },
                    id: Math.floor(Math.random() * 1000)
                })
            });
            const orderData = await response.json();
    
            // Update sales tax if it exists in the response
            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay.value = orderData.result.sales_tax.toFixed(2);
            } else {
                console.error("Sales tax not found in response:", orderData);
            }
        } catch (error) {
            console.error("Error fetching sales tax:", error);
        }
    },

    onClickClear(){
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
        }
        if (this.session.type === "remote") {
            await rpc(
                `/pos-customer-display/${this.session.config_id}`,
                {
                    access_token: this.session.access_token,
                    signature: this.signature.value || false,
                }
            );
        }
    },

    onSubmitSignature() {
        this.signature.value = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});