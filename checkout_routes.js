// checkout_routes.js — Thermomania AG
import Stripe from 'stripe';
import { requireAuth } from './auth.js';

// 💡 TIP: Usa tu clave secreta de PRUEBA de Stripe (empieza con sk_test_...)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost';

export function setupCheckoutRoutes(app, db, pushLog) {

    app.post('/api/checkout', requireAuth(db), async (req, res) => {
        const { items } = req.body; // Los productos del carrito
        const userId = req.user.userId;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "El carrito está vacío" });
        }

        try {
            // 1. Calcular el total y preparar los items para Stripe
            let totalPedido = 0;
            const lineItems = items.map(item => {
                totalPedido += (item.precio * item.cantidad);
                return {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: item.nombre,
                        },
                        unit_amount: Math.round(item.precio * 100), // Stripe maneja centavos
                    },
                    quantity: item.cantidad,
                };
            });

            // 2. Crear el registro del pedido en estado "pendiente" en la BD
            const [pedidoResult] = await db.query(
                "INSERT INTO pedidos (user_id, total, estado_pago) VALUES (?, ?, 'pendiente')",
                [userId, totalPedido]
            );
            const pedidoId = pedidoResult.insertId;

            // 3. Insertar los detalles del pedido
            for (const item of items) {
                await db.query(
                    "INSERT INTO detalles_pedido (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)",
                    [pedidoId, item.id, item.nombre, item.cantidad, item.precio]
                );
            }

            // 4. Crear la sesión de pago en Stripe
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                
                shipping_address_collection: {
                    allowed_countries: ['MX'], // Pide dirección solo de México
                },
                shipping_options: [
                    {
                        shipping_rate_data: {
                            type: 'fixed_amount',
                            fixed_amount: { amount: 0, currency: 'mxn' }, // Envío gratis
                            display_name: 'Envío Estándar Gratis',
                            delivery_estimate: {
                                minimum: { unit: 'business_day', value: 3 },
                                maximum: { unit: 'business_day', value: 5 },
                            },
                        },
                    },
                ],

                success_url: `${FRONTEND_URL}/pago-exitoso.html?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${FRONTEND_URL}/carrito.html`,
                client_reference_id: pedidoId.toString(), // Vinculamos la sesión de Stripe con nuestro pedido
            });

            // 5. Guardar el ID de la sesión en el pedido
            await db.query("UPDATE pedidos SET stripe_session_id = ? WHERE id = ?", [session.id, pedidoId]);

            pushLog({ level: "info", message: "checkout_iniciado", correlationId: req.correlationId, context: { pedidoId, userId } });

            // Devolver la URL de pago al frontend
            res.json({ url: session.url });

        } catch (err) {
            pushLog({ level: "error", message: "checkout_error", correlationId: req.correlationId, context: { error: err.message } });
            res.status(500).json({ error: "Error al procesar el pago" });
        }
    });
}