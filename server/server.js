
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Donation schema

const donationSchema = new mongoose.Schema(
    {
        foodName: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0.1,
            max: 500
        },
        description: {
            type: String,
            required: true,
            trim: true,
            minlength: 10,
            maxlength: 200
        },
        foodImage: { type: String, default: "" },
        preparedAt: { type: String, required: true },
        pickupDeadline: { type: String, required: true },
        storage: {
            type: String,
            enum: ["hot", "refrigerated", "room-temperature"],
            required: true
        },
        restaurantName: { type: String, default: "" },
        pickupAddress: { type: String, default: "" },
        contactPhone: { type: String, default: "" },
        mapsLink: { type: String, default: "" },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        status: {
            type: String,
            enum: ["Available", "Reserved", "Collected", "Delivered"],
            default: "Available"
        },
        reservedBy: { type: String, default: "" },
ngoPhone: { type: String, default: "" },
deliveryAddress: { type: String, default: "" },
reservedAt: { type: Date, default: null },
        volunteerName: { type: String, default: "" },
        volunteerPhone: { type: String, default: "" },
        collectedAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        deliveredBy: { type: String, default: "" },
        ngoConfirmedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

const Donation = mongoose.model("Donation", donationSchema);

// Home route
app.get("/", function (req, res) {
    res.json({
        message: "FoodBridge backend is running!"
    });
});

// Get all donations from MongoDB
app.get("/api/donations", async function (req, res) {
    try {
        const donations = await Donation.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            count: donations.length,
            donations: donations
        });
    } catch (error) {
        console.error("Fetch error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve donations."
        });
    }
});

 // Reserve a donation in MongoDB
app.patch("/api/donations/:id/reserve", async function (req, res) {
    try {
        const { id } = req.params;
        const { ngoName, ngoPhone, deliveryAddress } = req.body;

        if (!ngoName || !ngoPhone || !deliveryAddress) {
            return res.status(400).json({
                success: false,
                message: "NGO name, phone, and delivery address are required."
            });
        }

        const donation = await Donation.findOneAndUpdate(
            {
                _id: id,
                status: "Available"
            },
            {
                $set: {
                    status: "Reserved",
                    reservedBy: ngoName,
                    ngoPhone: ngoPhone,
                    deliveryAddress: deliveryAddress,
                    reservedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!donation) {
            return res.status(409).json({
                success: false,
                message: "Donation is unavailable or has already been reserved."
            });
        }

        res.json({
            success: true,
            message: "Food reserved successfully!",
            donation: donation
        });
    } catch (error) {
        console.error("Reservation error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to reserve donation."
        });
    }
});


 // Mark a reserved donation as collected
app.patch("/api/donations/:id/collect", async function (req, res) {
    try {
        const { id } = req.params;
        const { volunteerName, volunteerPhone } = req.body;

        if (
            !volunteerName ||
            !/^[6-9][0-9]{9}$/.test(volunteerPhone || "")
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid volunteer name and 10-digit phone number are required."
            });
        }

        const donation = await Donation.findOneAndUpdate(
            {
                _id: id,
                status: "Reserved"
            },
            {
                $set: {
                    status: "Collected",
                    volunteerName: volunteerName,
                    volunteerPhone: volunteerPhone,
                    collectedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!donation) {
            return res.status(409).json({
                success: false,
                message: "Donation is not awaiting collection."
            });
        }

        res.json({
            success: true,
            message: "Food marked as collected!",
            donation: donation
        });
    } catch (error) {
        console.error("Collection error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to update collection status."
        });
    }
});


 // Mark a collected donation as delivered
app.patch("/api/donations/:id/deliver", async function (req, res) {
    try {
        const { id } = req.params;
        const { volunteerName } = req.body;

        if (!volunteerName || !volunteerName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Volunteer name is required."
            });
        }

        const donation = await Donation.findOneAndUpdate(
            {
                _id: id,
                status: "Collected",
                volunteerName: volunteerName.trim()
            },
            {
                $set: {
                    status: "Delivered",
                    deliveredBy: volunteerName.trim(),
                    deliveredAt: new Date(),
                    ngoConfirmedAt: null
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!donation) {
            return res.status(409).json({
                success: false,
                message: "Donation is not awaiting delivery or the volunteer does not match."
            });
        }

        res.json({
            success: true,
            message: "Delivery recorded. NGO confirmation is pending.",
            donation: donation
        });
    } catch (error) {
        console.error("Delivery error:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to update delivery status."
        });
    }
});


/* NGO confirms receipt of delivered food */
app.patch("/api/donations/:id/confirm-receipt", async function (req, res) {
    try {
        const { id } = req.params;
        const { ngoName } = req.body;

        if (!ngoName || !ngoName.trim()) {
            return res.status(400).json({
                success: false,
                message: "NGO name is required."
            });
        }

        const donation = await Donation.findOneAndUpdate(
            {
                _id: id,
                status: "Delivered",
                reservedBy: ngoName.trim(),
                ngoConfirmedAt: null
            },
            {
                $set: {
                    ngoConfirmedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!donation) {
            return res.status(409).json({
                success: false,
                message: "Donation cannot be confirmed. Check its delivery status and NGO name."
            });
        }

        res.json({
            success: true,
            message: "Receipt confirmed successfully!",
            donation: donation
        });
    } catch (error) {
        console.error("Receipt confirmation error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to confirm receipt."
        });
    }
});


// Add a donation to MongoDB

app.post("/api/donations", async function (req, res) {
    try {
        const {
            foodName,
            quantity,
            description,
            foodImage,
            preparedAt,
            pickupDeadline,
            storage,
            restaurantName,
            pickupAddress,
            contactPhone,
            mapsLink,
            latitude,
            longitude
        } = req.body;

        if (
            typeof foodName !== "string" ||
            !foodName.trim() ||
            quantity === undefined ||
            quantity === null ||
            quantity === "" ||
            !Number.isFinite(Number(quantity)) ||
            Number(quantity) < 0.1 ||
            Number(quantity) > 500 ||
            typeof description !== "string" ||
            description.trim().length < 10 ||
            description.trim().length > 200 ||
            !preparedAt ||
            !pickupDeadline ||
            !["hot", "refrigerated", "room-temperature"].includes(storage)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid food details, quantity, description, dates, and storage."
            });
        }

        const preparedDate = new Date(preparedAt);
        const deadlineDate = new Date(pickupDeadline);

        if (
            Number.isNaN(preparedDate.getTime()) ||
            Number.isNaN(deadlineDate.getTime()) ||
            preparedDate > new Date() ||
            deadlineDate <= preparedDate ||
            deadlineDate <= new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "Preparation and pickup dates are invalid."
            });
        }

        const donation = await Donation.create({
            foodName: foodName.trim(),
            quantity: Number(quantity),
            description: description.trim(),
            foodImage: typeof foodImage === "string" ? foodImage.trim() : "",
            preparedAt,
            pickupDeadline,
            storage,
            restaurantName: typeof restaurantName === "string" ? restaurantName.trim() : "",
            pickupAddress: typeof pickupAddress === "string" ? pickupAddress.trim() : "",
            contactPhone: typeof contactPhone === "string" ? contactPhone.trim() : "",
            mapsLink: typeof mapsLink === "string" ? mapsLink.trim() : "",
            latitude: Number.isFinite(Number(latitude)) && latitude !== null && latitude !== "" ? Number(latitude) : null,
            longitude: Number.isFinite(Number(longitude)) && longitude !== null && longitude !== "" ? Number(longitude) : null,
            status: "Available"
        });

        res.status(201).json({
            success: true,
            message: "Donation saved to MongoDB!",
            donation
        });
    } catch (error) {
        console.error("Save error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to save donation."
        });
    }
});


// Connect to MongoDB, then start the server
async function startServer() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI is missing. Check your .env file.");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB Atlas successfully!");

        app.listen(PORT, function () {
            console.log(`FoodBridge server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

// DELETE a donation from MongoDB
app.delete("/api/donations/:id", async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: "Donation not found."
            });
        }

        if (donation.status !== "Available") {
            return res.status(400).json({
                success: false,
                message: "Only available donations can be removed."
            });
        }

        await Donation.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Donation removed successfully."
        });
    } catch (error) {
        console.error("Delete donation error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove donation."
        });
    }
});
startServer();
