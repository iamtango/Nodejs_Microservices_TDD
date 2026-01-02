import { Schema, model, Document, Types } from "mongoose";
import { OfferType } from "./fruit";

// Interface for Cart Item
export interface ICartItem {
    fruitId: Types.ObjectId;
    name: string;
    price: number;
    quantity: number; // Paid quantity
    offerType: OfferType;
    freeItems: number; // Free promotional items
    addedAt: Date;
}

// Interface for Cart document
export interface ICart extends Document {
    userId: string;
    items: ICartItem[];
    totalItems: number;
    totalPrice: number;
    discountAmount: number;
    finalPrice: number;
    createdAt: Date;
    updatedAt: Date;
}

// Cart Item Schema
const cartItemSchema = new Schema<ICartItem>({
    fruitId: {
        type: Schema.Types.ObjectId,
        ref: 'Fruit',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    offerType: {
        type: String,
        enum: Object.values(OfferType),
        default: OfferType.NONE
    },
    freeItems: {
        type: Number,
        default: 0,
        min: 0
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Cart Schema
const cartSchema = new Schema<ICart>({
    userId: {
        type: String,
        required: true,
        unique: true // unique already creates an index
    },
    items: {
        type: [cartItemSchema],
        default: []
    },
    totalItems: {
        type: Number,
        default: 0,
        min: 0
    },
    totalPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    finalPrice: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

export default model<ICart>("Cart", cartSchema);
