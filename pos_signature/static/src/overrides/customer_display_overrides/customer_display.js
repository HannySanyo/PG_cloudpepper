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
        
        // Initialize the state with default values
        this.state = useState({
            signature: '',
            salesTaxDisplay: '0.00',
            orderId: null  // New state property to store the fetched order ID
        });
        
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        
        effect(
            batched(
                ({ signature }) => {
                    if (!signature) return;
                    this.sendSignatureData(signature);
                }
            ),
            [this.state]
        );

        this.drawing = false;

        // Fetch the order ID first, then load sales tax data once it’s available
        this.fetchOrderId();
    },

    // New function to fetch the order ID based on order details
    async fetchOrderId() {
        try {
            const response = await fetch('/pos/get_order_id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: { amount: this.order.amount },  // Use any other unique identifiers here
                    id: Math.floor(Math.random() * 1000)
                })
            });
            const orderData = await response.json();

            if (orderData.result && orderData.result.id) {
                console.log("Fetched Order ID:", orderData.result.id);
                this.state.orderId = orderData.result.id;  // Store the order ID in state
                this.loadSalesTax();  // Call loadSalesTax once the ID is available
            } else {
                console.error("Order ID not found in response:", orderData);
            }
        } catch (error) {
            console.error("Error fetching order ID:", error);
        }
    },

    async loadSalesTax() {
        if (!this.state.orderId) {  // Use state.orderId instead of this.order.id
            console.error("Order ID is missing. Cannot fetch sales tax.");
            return;
        }
        
        console.log("Using Order ID:", this.state.orderId);  // Log the order ID to confirm it
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
                    params: { id: this.state.orderId },  // Use the fetched order ID
                    id: Math.floor(Math.random() * 1000)  // Unique ID for JSON-RPC request
                })
            });
            const orderData = await response.json();
    
            // Debugging log to confirm the server response
            console.log("Fetched sales tax data:", orderData);

            // Update state with sales tax if it exists in the response
            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.state.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
                console.log("Updated salesTaxDisplay:", this.state.salesTaxDisplay); // Confirm the assignment
                this.render();  // Trigger re-render to reflect updated tax on display
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
        const rect = canvas.getBoundingClientRect(); // Get canvas position and size
    
        // Adjust the coordinates based on the canvas's scale
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
    
    draw(event) {
        if (!this.drawing) return;
    
        const { x, y } = this.getPosition(event);
        this.signature_done = true;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath(); // Reset the path
        this.ctx.moveTo(x, y); // Move to the current position for the next line segment
    
        [this.lastX, this.lastY] = [x, y]; // Update the last coordinates
    },

    async sendSignatureData(signature) {
        if (this.session.type === "local") {
            this.customerDisplayChannel.postMessage({test:'test', signature: signature});
        }
        if (this.session.type === "remote") {
            const data = await rpc(
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