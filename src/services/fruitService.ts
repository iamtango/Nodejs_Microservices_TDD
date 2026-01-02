import Fruit, { IFruit, OfferType } from '../models/fruit';

export interface CreateFruitDto {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  offerType?: OfferType;
  offerDescription?: string;
  imageUrl?: string;
  category?: string;
  rating?: number;
  inStock?: boolean;
  stockQuantity?: number;
}

export interface UpdateFruitDto {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  offerType?: OfferType;
  offerDescription?: string;
  imageUrl?: string;
  category?: string;
  rating?: number;
  inStock?: boolean;
  stockQuantity?: number;
}

// Sort options enum
export enum SortBy {
  PRICE = 'price',
  RATING = 'rating',
  NAME = 'name'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

// Query options for getting fruits
export interface GetFruitsOptions {
  id?: string;           // Get specific fruit by ID
  q?: string;            // Search query for name
  category?: string;     // Filter by category
  hasOffer?: boolean;    // Filter fruits with active offers
  page?: number;         // Page number (1-indexed)
  limit?: number;        // Page size (max 50)
  sortBy?: SortBy;       // Field to sort by (price, rating, name)
  sortOrder?: SortOrder; // Sort order (asc, desc)
}

// Result interface with pagination info
export interface GetFruitsResult {
  fruits: IFruit[];
  fruit?: IFruit | null;  // Single fruit when querying by ID
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Consolidated function to get fruits with filters and pagination
export const getFruits = async (options: GetFruitsOptions = {}): Promise<GetFruitsResult> => {
  const { id, q, category, hasOffer, sortBy, sortOrder } = options;
  
  // Page-based pagination
  const page = options.page || 1;
  let limit = options.limit || 10;
  limit = limit > 50 ? 50 : limit;
  const skip = (page - 1) * limit;

  // If ID is provided, get a single fruit
  if (id) {
    const fruit = await Fruit.findById(id).select('-__v -createdAt -updatedAt');
    return {
      fruits: fruit ? [fruit] : [],
      fruit,
      pagination: {
        page: 1,
        limit: 1,
        total: fruit ? 1 : 0,
        totalPages: fruit ? 1 : 0,
        hasMore: false
      }
    };
  }

  // Build the query filter
  const filter: Record<string, unknown> = {};

  // Search by name (case-insensitive)
  if (q) {
    filter.name = { $regex: q, $options: 'i' };
  }

  // Filter by category
  if (category) {
    filter.category = category;
    filter.inStock = true;
  }

  // Filter fruits with active offers
  if (hasOffer) {
    filter.offerType = { $ne: OfferType.NONE };
    filter.inStock = true;
  }

  // Get total count for pagination
  const total = await Fruit.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  // Build sort object based on sortBy and sortOrder
  // Default: sort by name ascending
  let sortOptions: Record<string, 1 | -1> = { name: 1 };

  if (sortBy) {
    const order = sortOrder === SortOrder.DESC ? -1 : 1;
    
    switch (sortBy) {
      case SortBy.PRICE:
        // Sort by price, tie-breaker: highest rating first
        sortOptions = { price: order, rating: -1 };
        break;
      case SortBy.RATING:
        // Sort by rating, tie-breaker: cheapest price first
        sortOptions = { rating: order, price: 1 };
        break;
      case SortBy.NAME:
        sortOptions = { name: order };
        break;
      default:
        sortOptions = { name: 1 };
    }
  }

  // Fetch fruits with pagination and sorting
  const fruits = await Fruit.find(filter)
    .select('-__v -createdAt -updatedAt')
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  return {
    fruits,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages
    }
  };
};

// Create a new fruit
export const createFruit = async (fruitData: CreateFruitDto): Promise<IFruit> => {
  const fruit = new Fruit({
    ...fruitData,
    offerType: fruitData.offerType || OfferType.NONE,
    inStock: fruitData.inStock !== undefined ? fruitData.inStock : true,
    stockQuantity: fruitData.stockQuantity || 0
  });
  const savedFruit = await fruit.save();
  // Return the fruit without internal fields
  return await Fruit.findById(savedFruit._id).select('-__v -createdAt -updatedAt') as IFruit;
};

// Update fruit
export const updateFruit = async (id: string, updateData: UpdateFruitDto): Promise<IFruit | null> => {
  return await Fruit.findByIdAndUpdate(id, updateData, { new: true }).select('-__v -createdAt -updatedAt');
};

// Delete fruit
export const deleteFruit = async (id: string): Promise<IFruit | null> => {
  return await Fruit.findByIdAndDelete(id).select('-__v -createdAt -updatedAt');
};

// Update stock quantity
export const updateStock = async (id: string, quantity: number): Promise<IFruit | null> => {
  return await Fruit.findByIdAndUpdate(
    id, 
    { stockQuantity: quantity, inStock: quantity > 0 }, 
    { new: true }
  ).select('-__v -createdAt -updatedAt');
};
