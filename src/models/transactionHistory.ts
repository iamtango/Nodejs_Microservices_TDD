import { Schema, model, Document, Types } from "mongoose";
import { OfferType } from "./fruit";

// Enum for transaction status
export enum TransactionStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    REFUNDED = "REFUNDED",
    FAILED = "FAILED"
}

// Enum for payment method
export enum PaymentMethod {
    CASH = "CASH",
    CREDIT_CARD = "CREDIT_CARD",
    DEBIT_CARD = "DEBIT_CARD",
    UPI = "UPI",
    NET_BANKING = "NET_BANKING",
    WALLET = "WALLET"
}

// Interface for individual items in transaction
export interface ITransactionItem {
    fruitId: Types.ObjectId;
    fruitName: string;
    quantity: number;
    pricePerUnit: number;
    offerApplied: OfferType;
    freeItemsReceived: number;
    subtotal: number;
}

// Interface for TransactionHistory document
export interface ITransactionHistory extends Document {
    userId: Types.ObjectId;
    items: ITransactionItem[];
    totalAmount: number;
    discountAmount: number;
    finalAmount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: TransactionStatus;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const transactionItemSchema = new Schema({
    fruitId: {
        type: Schema.Types.ObjectId,
        ref: "Fruit",
        required: true
    },
    fruitName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    pricePerUnit: {
        type: Number,
        required: true,
        min: 0
    },
    offerApplied: {
        type: String,
        enum: Object.values(OfferType),
        default: OfferType.NONE
    },
    freeItemsReceived: {
        type: Number,
        default: 0,
        min: 0
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const transactionHistorySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: {
        type: [transactionItemSchema],
        required: true,
        validate: {
            validator: function(items: ITransactionItem[]) {
                return items && items.length > 0;
            },
            message: "Transaction must have at least one item"
        }
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    finalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR", "GBP"]
    },
    paymentMethod: {
        type: String,
        enum: Object.values(PaymentMethod),
        required: true
    },
    status: {
        type: String,
        enum: Object.values(TransactionStatus),
        default: TransactionStatus.PENDING
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for faster queries
transactionHistorySchema.index({ userId: 1 });
transactionHistorySchema.index({ status: 1 });
transactionHistorySchema.index({ createdAt: -1 });

export default model<ITransactionHistory>("TransactionHistory", transactionHistorySchema);
