import { Schema, model, Document } from "mongoose";

// Enum for offer types
export enum OfferType {
    NONE = "NONE",
    BUY_1_GET_1_FREE = "BUY_1_GET_1_FREE",
    BUY_2_GET_3_FREE = "BUY_2_GET_3_FREE",
    BUY_3_GET_5_FREE = "BUY_3_GET_5_FREE"
}

// Interface for Fruit document
export interface IFruit extends Document {
    name: string;
    description?: string;
    price: number;
    currency: string;
    offerType: OfferType;
    offerDescription?: string;
    imageUrl?: string;
    category?: string;
    rating: number;
    inStock: boolean;
    stockQuantity: number;
    createdAt: Date;
    updatedAt: Date;
}

const fruitSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR", "GBP"]
    },
    offerType: {
        type: String,
        enum: Object.values(OfferType),
        default: OfferType.NONE
    },
    offerDescription: {
        type: String,
        trim: true
    },
    imageUrl: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        trim: true,
        default: "General"
    },
    inStock: {
        type: Boolean,
        default: true
    },
    stockQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    }
}, {
    timestamps: true
});

// Index for faster searches
fruitSchema.index({ name: 1 });
fruitSchema.index({ category: 1 });
fruitSchema.index({ offerType: 1 });
fruitSchema.index({ price: 1 });
fruitSchema.index({ rating: -1 });
fruitSchema.index({ price: 1, rating: -1 });
fruitSchema.index({ rating: -1, price: 1 });

export default model<IFruit>("Fruit", fruitSchema);
