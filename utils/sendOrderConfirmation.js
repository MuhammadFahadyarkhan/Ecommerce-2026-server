import { Resend } from 'resend';

const sendOrderConfirmation = async ({
    email,
    subject,
    orderId,
    products,
    totalAmount
}) => {
    // Initialize inside the function so process.env is fully loaded
    const resend = new Resend(process.env.RESEND_API_KEY);

    const productsHtml = products
        .map(
            (product) => `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${product.name}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${product.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">₨${product.price}</td>
            </tr>
        `
        )
        .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f9f9f9;
            height: 100vh;
        }
        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        h1 {
            color: #4caf50;
        }
        p {
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            border: 1px solid #ddd;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
        .total {
            font-size: 18px;
            font-weight: bold;
            color: #000;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Order Confirmation</h1>
        <p>Dear ${email},</p>
        <p>Your order (ID: <strong>${orderId}</strong>) has been successfully placed.</p>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price</th>
                </tr>
            </thead>
            <tbody>
                ${productsHtml}
            </tbody>
        </table>
        <p class="total">Total Amount: ₨${totalAmount}</p>
        <p>Thank you for shopping with us!</p>
    </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [email],
        subject,
        html,
    });

    if (error) {
        console.error("Resend API Error:", error);
        throw new Error(error.message);
    }

    return data;
};

export default sendOrderConfirmation;