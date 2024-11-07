# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################

from odoo import http, fields
from odoo.http import request
import logging
_logger = logging.getLogger(__name__)

class PosCustomerDisplayController(http.Controller):

    @http.route("/pos-customer-display/<config_id>/", auth="public", type="json", website=True)
    def process_order(self, access_token, signature, config_id):
        pos_config_sudo = request.env['pos.config'].sudo().search([('access_token', '=', access_token)], limit=1)
        pos_config_sudo.update_customer_signature(signature, access_token)
        return True

    @http.route('/pos/get_sales_tax', type='json', auth='user', methods=['POST'])
    def get_sales_tax(self, order_id=None):
        """
        Endpoint to retrieve sales tax information for a POS order.
        :param order_id: ID of the POS order for which to retrieve tax info.
        :return: JSON response with 'sales_tax' amount or an error message.
        """
        try:
            # Retrieve the order using the provided order_id
            order = request.env['pos.order'].browse(order_id)

            # Check if the order exists and calculate tax
            if not order.exists():
                return {'error': 'Order not found'}
            
            # Get the sales tax from the order
            sales_tax = order.amount_tax

            # Return the sales tax in JSON format
            return {'sales_tax': sales_tax}
        except Exception as e:
            _logger.error("Error fetching sales tax: %s", e)
            return {'error': str(e)}