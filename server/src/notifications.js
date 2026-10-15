export function notificationTemplate(role, type, data = {}) {
  const admin = role === 'ADMIN';
  const who = data.customerName || 'A customer';
  const order = `#${data.orderNumber || data.orderCode || ''}`;
  const price = `₹${data.total ?? data.amount ?? ''}`;
  const status = String(data.status || 'updated').replace(/^has been /, '').replace(/^is now /, '');
  const table = {
    ORDER_PLACED: admin
      ? ['New order received', `${who} placed order ${order} for ${price}.`, { orderId: data.orderId }]
      : ['Order placed', 'Your order has been placed successfully.', { orderId: data.orderId }],
    PAYMENT_SUCCESS: admin ? ['Payment received', `Payment of ${price} was received for order ${order}.`] : ['Payment successful', `Your payment of ${price} for order ${order} was successful.`],
    ORDER_ACCEPTED: ['Order accepted', `Your order has been accepted! ${order} is being prepared.`, { orderId: data.orderId, status: 'CONFIRMED' }],
    ORDER_REJECTED: ['Order rejected', `Your order has been rejected. ${order}.${data.reason ? ` Reason: ${data.reason}` : ''}`, { orderId: data.orderId, reason: data.reason }],
    ORDER_STATUS: data.status === 'has been delivered'
      ? ['Order delivered', `Your order has been delivered! ${order} is delivered.`, { orderId: data.orderId, status: 'DELIVERED' }]
      : data.status === 'is out for delivery'
        ? ['Out for delivery', `Your order is out for delivery! ${order}`, { orderId: data.orderId, status: 'OUT_FOR_DELIVERY' }]
        : ['Order update', `Your order ${order} is ${status}.`, { orderId: data.orderId, status: data.status }],
    ORDER_CANCELLED: admin ? ['Order cancelled', `Order ${order} has been cancelled by the customer.`] : ['Order cancelled', `Your order ${order} has been cancelled.`],
    CUSTOM_ORDER: admin ? ['New custom order', `${who} submitted a new custom cake request.`] : ['Custom order update', 'Your custom cake request was submitted.'],
    CUSTOM_REQUEST: admin ? ['New custom order', `${who} submitted a new custom cake request.`] : ['Custom order update', 'Your custom cake request was submitted.'],
    CUSTOM_ACCEPTED: ['Custom order accepted', 'Your custom cake request has been accepted.'],
    CUSTOM_REJECTED: ['Custom order update', 'Your custom cake request was not accepted.'],
    NEW_CUSTOMER: ['New customer', `A new customer, ${data.customerName || 'a customer'}, has registered.`],
    NEW_MESSAGE: admin ? ['New customer message', `You have a new message from ${who}.`] : ['New message', 'You have a new message from Shivam Store.'],
    PROMOTIONS: ['New offer', data.message || 'A new offer is available.'],
    NEW_PRODUCT: ['New product', data.message || 'A new product is available.'],
  };
  const [title, message, extra] = table[type] || [data.title || 'Shivam Store update', data.message || 'You have a new update.'];
  return [title, message, extra ? { ...data, ...extra } : message];
}
