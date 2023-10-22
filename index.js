const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.DB_StripKey);
const app = express()
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ljxdfal.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db('Doctors-Portal');
        const appointmentOption = database.collection('Slots');
        const bookingCollection = database.collection('Booking');
        const userCollection = database.collection('Users');
        const doctorsCollection = database.collection('Doctors');

        app.get('/', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await appointmentOption.find(query).toArray();
            const booking = { date: date };
            const booked = await bookingCollection.find(booking).toArray();

            options.forEach(option => {
                const bookedOption = booked.filter(book => book.treatment == option.name);
                const bookedSlots = bookedOption.map(book => book.slot);
                const remaining = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remaining;
            })

            res.send(options);
        });

        app.get('/booking', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const query = {};
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const admin = await userCollection.findOne(query);
            res.send({ isAdmin: admin?.status == 'admin' });
        })

        app.get('/job', async (req, res) => {
            const query = {};
            const job = await appointmentOption.find(query).project({ name: 1 }).toArray();
            res.send(job)
        });

        app.get('/doctors', async (req, res) => {
            const query = {};
            const doctors = await doctorsCollection.find(query).toArray();
            res.send(doctors);
        });

        app.get('/bookings', async (req, res) => {
            const query = {};
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        // post

        app.post('/booking', async (req, res) => {
            const optionOfBook = req.body;
            const query = {
                date: optionOfBook.date,
                email: optionOfBook.email,
                treatment: optionOfBook.treatment
            }
            const booked = await bookingCollection.find(query).toArray();
            if (booked.length) {
                const message = `You Have already booked in ${optionOfBook.date}`;
                return res.send({ acknowledged: false, message });
            }
            const result = await bookingCollection.insertOne(optionOfBook);
            res.send(result);
        });

        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // post

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.post('/add-doctor', async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        })

        //  Update

        app.put('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const option = { upsert: true };
            const update = {
                $set: {
                    status: 'admin'
                }
            }
            const result = await userCollection.updateOne(query, update, option);
            res.send(result);
        });
        app.put('/user/r/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const option = { upsert: true };
            const update = {
                $set: {
                    status: 'user'
                }
            }
            const result = await userCollection.updateOne(query, update, option);
            res.send(result);
        });
        app.put('/paid/:id', async (req, res) => {
            const id = req.params.id;
            const pay = req.body;
            const query = { _id: new ObjectId(id) };
            const option = { upsert: true };
            const update = {
                $set: {
                    price: pay.paid,
                    paymentId: pay.paymentId,
                    paid: pay.payStatus
                }
            }
            const result = await bookingCollection.updateOne(query, update, option);
            res.send(result);
        })


        // delete 

        app.delete('/user/d/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        app.delete('/doctor-delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await doctorsCollection.deleteOne(query);
            res.send(result);
        })

    } finally {

    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Doctor-Portal port ${port}`)
})