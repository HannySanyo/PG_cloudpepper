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
        """
        Endpoint to process a POS order and update the customer's signature.
        :param access_token: Access token for POS authentication.
        :param signature: Base64 encoded signature data.
        :param config_id: ID of the POS configuration.
        :return: JSON response indicating success or failure.
        """
        try:
            pos_config_sudo = request.env['pos.config'].sudo().search([('access_token', '=', access_token)], limit=1)
            if pos_config_sudo:
                pos_config_sudo.update_customer_signature(signature, access_token)
                return {'success': True, 'message': 'Signature updated successfully'}
            else:
                return {'success': False, 'message': 'POS config not found for given access token'}
        except Exception as e:
            _logger.error("Error processing order: %s", e)
            return {'success': False, 'error': str(e)}

    @http.route('/pos/get_sales_tax', type='json', auth='user', methods=['POST'])
    def get_sales_tax(self, id=None):
        """
        Endpoint to retrieve sales tax information for a POS order.
        :param id: ID of the POS order for which to retrieve tax info.
        :return: JSON response with 'sales_tax' amount or an error message.
        """
        try:
            # Log the entire request parameters to see what is actually received
            _logger.info("Request params: %s", request.params)

            # Check if id is provided
            if id is None:
                return {'error': 'Order ID not provided'}

            # Explicit search by ID to ensure retrieval
            order = request.env['pos.order'].sudo().search([('id', '=', int(id))], limit=1)

            # Check if the order exists and calculate tax
            if not order:
                return {'error': 'Order not found'}
            
            # Get the sales tax from the order
            sales_tax = order.amount_tax

            # Return the sales tax in JSON format
            return {'sales_tax': sales_tax}
        except Exception as e:
            _logger.error("Error fetching sales tax: %s", e)
            return {'error': str(e)}

    @http.route('/pos/get_order_id', type='json', auth='user', methods=['POST'])
    def get_order_id(self, amount=None):
        """
        Endpoint to retrieve order ID based on amount.
        :param amount: Total amount of the POS order for which to retrieve the ID.
        :return: JSON response with the 'id' of the matching order or an error message.
        """
        try:
            order = request.env['pos.order'].sudo().search([('amount_total', '=', amount)], limit=1)
            if not order:
                return {'error': 'Order not found'}
            return {'id': order.id}
        except Exception as e:
            _logger.error("Error fetching order ID: %s", e)
            return {'error': str(e)}