export function notificationTemplate(role, type, data = {}) {
  const admin = role === 'ADMIN'; const who = data.customerName || 'A customer'; const order = `#${data.orderNumber || data.orderCode || ''}`;
  const price = `₹${data.total ?? data.amount ?? ''}`;
  const table = {
    ORDER_PLACED: admin ? ['🔔 New Order Received', `${who} placed order ${order} for ${price}.`] : ['🛍️ Order Placed', `Your order ${order} has been successfully placed.`],
    PAYMENT_SUCCESS: admin ? ['💳 Payment Received', `Payment of ${price} was received for order ${order}.`] : ['💳 Payment Successful', `Your payment of ${price} for order ${order} was successful.`],
    ORDER_ACCEPTED: ['✅ Order Accepted', `Your order ${order} has been accepted and is being prepared.`],
    ORDER_REJECTED: ['❌ Order Rejected', `Unfortunately, your order ${order} was rejected.`],
    ORDER_STATUS: ['📦 Order Update', `Your order ${order} is ${String(data.status || 'updated').replace(/^has been /, '').replace(/^is now /, '')}.`],
    ORDER_CANCELLED: admin ? ['⚠️ Order Cancelled', `Order ${order} has been cancelled by the customer.`] : ['⚠️ Order Cancelled', `Your order ${order} has been cancelled.`],
    CUSTOM_ORDER: admin ? ['🎂 New Custom Order', `${who} submitted a new custom cake request.`] : ['🎂 Custom Order Update', 'Your custom cake request was submitted.'],
    CUSTOM_REQUEST: admin ? ['🎂 New Custom Order', `${who} submitted a new custom cake request.`] : ['🎂 Custom Order Update', 'Your custom cake request was submitted.'],
    CUSTOM_ACCEPTED: ['🎂 Custom Order Accepted', 'Your custom cake request has been accepted.'], CUSTOM_REJECTED: ['🎂 Custom Order Update', 'Your custom cake request was not accepted.'],
    NEW_CUSTOMER: ['👤 New Customer', `A new customer, ${data.customerName || 'a customer'}, has registered.`],
    NEW_MESSAGE: admin ? ['💬 New Customer Message', `You have a new message from ${who}.`] : ['💬 New Message', 'You have a new message from Shivam Store.'],
    PROMOTIONS: ['🎁 New Offer', data.message || 'A new offer is available.'], NEW_PRODUCT: ['🆕 New Product', data.message || 'A new product is available.'],
  };
  return table[type] || [data.title || 'Shivam Store update', data.message || 'You have a new update.'];
}
