import { useSeo } from '../ui.jsx';

export function PrivacyPolicy() {
  useSeo('Privacy Policy', 'How Shivam Store handles account, address, order and payment information.');
  return <article className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-3xl font-extrabold">Privacy Policy</h1>
    <p className="text-sm text-neutral-600">Last updated: October 15, 2026</p>
    <p>Shivam Store uses information you provide to operate this online shop, fulfil orders and respond to support requests.</p>
    <section><h2 className="text-xl font-bold">Information we handle</h2><p className="mt-2">This can include your name, email address, phone number, delivery address, account credentials, order history, product reviews, messages to support and details you submit for a custom cake request. The site also stores your cart and session information in your browser.</p></section>
    <section><h2 className="text-xl font-bold">How we use it</h2><p className="mt-2">We use this information to create and secure your account, process orders and payments, arrange delivery, provide order updates, handle custom requests, prevent misuse and answer questions.</p></section>
    <section><h2 className="text-xl font-bold">Payments and service providers</h2><p className="mt-2">Online payments are handled by the payment provider presented at checkout. Shivam Store does not store your full card details. Information may be processed by providers used to host the site, send email, store product images or operate payments, to the extent those services are enabled.</p></section>
    <section><h2 className="text-xl font-bold">Sharing and retention</h2><p className="mt-2">We share relevant information with service providers and delivery personnel when needed to run the service. We do not sell personal information. We keep information for as long as needed to provide the service, meet legal obligations and resolve order or account issues.</p></section>
    <section><h2 className="text-xl font-bold">Your choices and requests</h2><p className="mt-2">You can update some account details through your account page. To ask about, correct or request deletion of personal information, contact Shivam Store through the support chat in your account and include enough detail for us to locate your request.</p></section>
    <section><h2 className="text-xl font-bold">Security and changes</h2><p className="mt-2">We use reasonable safeguards for account and order information, but no internet service can guarantee absolute security. We may update this policy as the service changes. The date above indicates the latest revision.</p></section>
  </article>;
}

export function Terms() {
  useSeo('Terms and Conditions', 'Terms for using the Shivam Store website and placing orders.');
  return <article className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-3xl font-extrabold">Terms and Conditions</h1>
    <p className="text-sm text-neutral-600">Last updated: October 15, 2026</p>
    <p>These terms apply when you browse Shivam Store or place an order through this website. By using the site, you agree to them.</p>
    <section><h2 className="text-xl font-bold">Orders and availability</h2><p className="mt-2">Product listings, prices and stock can change. An order request is subject to stock and confirmation by Shivam Store. We will contact you if an item cannot be supplied or an order needs to change. The prices, delivery charges, available areas and delivery slots shown at checkout apply to your order.</p></section>
    <section><h2 className="text-xl font-bold">Payment and cancellation</h2><p className="mt-2">Available payment methods are shown at checkout. Online payments are subject to verification by the payment provider. If an order cannot be fulfilled, any payment handling or refund will be arranged using the applicable payment method and provider process. Contact support promptly to request a change or cancellation; a request may not be possible once preparation or delivery has begun.</p></section>
    <section><h2 className="text-xl font-bold">Custom cakes and food</h2><p className="mt-2">A custom cake request is not confirmed until Shivam Store accepts it and you complete the confirmation and payment steps shown on the site. The final design and price will be confirmed before payment. Please provide accurate allergy and dietary information. Food is prepared using ingredients handled in a working bakery, so we cannot promise an allergen-free environment.</p></section>
    <section><h2 className="text-xl font-bold">Your account and site use</h2><p className="mt-2">Keep your login details private and provide accurate contact and delivery information. Do not misuse the site, interfere with its operation, submit unlawful content or use another person's account without permission. We may restrict access where needed to protect customers or the service.</p></section>
    <section><h2 className="text-xl font-bold">Questions</h2><p className="mt-2">For order or account questions, use the support chat available through your account on this website.</p></section>
  </article>;
}
