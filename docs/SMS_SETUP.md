# MSG91 SMS setup

Shivam Store sends transactional and admin alerts through the MSG91 Flow API from the Express server. The browser never receives the MSG91 Auth Key. SMS is disabled only when `SMS_ENABLED=false`; missing configuration or provider failures do not undo store operations.

## MSG91 and India setup

1. Create an MSG91 account and complete the account verification required for India.
2. Complete the applicable DLT entity/principal entity registration.
3. Register an approved sender/header with your operator and DLT portal.
4. Register and get approval for the transactional templates listed below. Match the message and variables to the approved DLT content exactly.
5. Create a Flow template for each approved message in MSG91 and copy its Flow Template ID.
6. Obtain the Auth Key from MSG91. Keep it only in Render's backend environment.
7. Add the variables listed below to the relevant Render variables. If your Flow variable names differ, set the corresponding `MSG91_VARIABLES_<EVENT>` value to a JSON object that maps the logical fields to the exact MSG91 variable names. Example: `{"customer_name":"customer_name","order_id":"order_id","amount":"amount"}`. Do not assume the example names match your approved Flow.
8. Add admin numbers as comma-separated India mobiles in `ADMIN_SMS_NUMBERS`, e.g. `919876543210,919812345678`. The server normalizes and masks them in logs.
9. Deploy the backend. No SMS credential or API call belongs in Vercel/Vite.
10. In Admin → Settings, confirm the SMS status and send a test SMS to an admin number from `ADMIN_SMS_NUMBERS`.

## Flow templates

Create an MSG91 Flow template and set the matching environment variable for each event:

| Event | Template ID environment variable | Logical fields sent |
| --- | --- | --- |
| Order placed | `MSG91_TEMPLATE_ORDER_PLACED` | `customer_name`, `order_id`, `amount` |
| Order accepted | `MSG91_TEMPLATE_ORDER_ACCEPTED` | `customer_name`, `order_id`, `amount` |
| Order rejected/cancelled | `MSG91_TEMPLATE_ORDER_REJECTED` | `customer_name`, `order_id`, `amount`, `reason` |
| Out for delivery | `MSG91_TEMPLATE_OUT_FOR_DELIVERY` | `customer_name`, `order_id`, `amount` |
| Delivered | `MSG91_TEMPLATE_ORDER_DELIVERED` | `customer_name`, `order_id`, `amount` |
| Admin new order | `MSG91_TEMPLATE_ADMIN_NEW_ORDER` | `customer_name`, `order_id`, `amount` |
| Admin new product | `MSG91_TEMPLATE_ADMIN_NEW_PRODUCT` | `product_name` |
| Payment success | `MSG91_TEMPLATE_PAYMENT_SUCCESS` | `customer_name`, `order_id`, `amount` |
| Customer registered | `MSG91_TEMPLATE_CUSTOMER_REGISTERED` | `customer_name` |
| Test SMS | `MSG91_TEMPLATE_TEST` | No fields required by the integration |

These are the integration's logical field names. Your Flow's exact variable names must match MSG91 configuration. Use `MSG91_VARIABLES_<EVENT>` JSON maps when MSG91 expects different names. For example, if the placed-order Flow uses `##name##`, `##reference##`, and `##total##`, set `MSG91_VARIABLES_ORDER_PLACED={"customer_name":"name","order_id":"reference","amount":"total"}`. Template IDs and message wording come from your approved MSG91 templates; this app does not hard-code SMS copy.

## Render environment variables

Set these on the **backend Render service** as needed:

```text
MSG91_AUTH_KEY=<your MSG91 Auth Key>
MSG91_TEMPLATE_ORDER_PLACED=<Flow ID>
MSG91_TEMPLATE_ORDER_ACCEPTED=<Flow ID>
MSG91_TEMPLATE_ORDER_REJECTED=<Flow ID>
MSG91_TEMPLATE_OUT_FOR_DELIVERY=<Flow ID>
MSG91_TEMPLATE_ORDER_DELIVERED=<Flow ID>
MSG91_TEMPLATE_ADMIN_NEW_ORDER=<Flow ID>
MSG91_TEMPLATE_ADMIN_NEW_PRODUCT=<Flow ID>
MSG91_TEMPLATE_PAYMENT_SUCCESS=<Flow ID>
MSG91_TEMPLATE_CUSTOMER_REGISTERED=<Flow ID>
MSG91_TEMPLATE_TEST=<approved test Flow ID>
ADMIN_SMS_NUMBERS=919876543210,919812345678
SMS_ENABLED=true
```

Add the `MSG91_VARIABLES_<EVENT>` mappings only where your approved Flow variable names differ from the logical fields above. Never use a `VITE_MSG91_AUTH_KEY` variable. The Auth Key, admin numbers, and template IDs must not be placed in client build variables.

## How SMS is triggered

- Order placed: after order persistence and payment initialization. Customer delivery uses the saved profile phone, then the checkout phone as fallback. Admin numbers receive the new-order alert.
- Order accepted, rejected/cancelled, out for delivery, and delivered: after an actual valid admin status transition.
- Payment success: after successful payment verification; repeat verification is ignored.
- New active product and first publish: admin numbers receive the product alert.
- Customer registration: the saved profile phone receives the welcome/registration template after email verification.

An SMS event key is saved in MongoDB to suppress duplicate sends. Failed sends can be retried by a later event attempt; a send already in progress or marked sent is suppressed. Phone numbers are masked in logs.

## Test

1. Set the Render environment variables and deploy.
2. Add an admin test number to `ADMIN_SMS_NUMBERS`.
3. Sign in to the Admin Panel and open **Settings**.
4. Confirm Provider/status and the three event toggles.
5. Enter the configured admin number and press **Send Test SMS**. The test Flow template must be configured. The endpoint accepts no message body from the browser and rejects numbers outside the admin list.
6. Place a test COD order, update its status from the admin order panel, and verify each configured Flow. Use the app's payment test mode only outside production for a payment-success check.

