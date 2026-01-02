import { Request, Response } from 'express';
import {
  getFruits,
  createFruit,
  updateFruit,
  deleteFruit,
  updateStock,
  CreateFruitDto,
  UpdateFruitDto,
  SortBy,
  SortOrder
} from '../services/fruitService';
import { FruitResponse } from '../types';

// Unified controller to get fruits with filters and pagination
// Query params: id, q (search), category, hasOffer, page, limit, sortBy, sortOrder
export const getFruitsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, q, category, hasOffer, page, limit, sortBy, sortOrder } = req.query;

    // Parse and validate pagination parameters
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 10;

    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        message: 'Invalid page parameter. Must be a positive integer.'
      } as FruitResponse);
      return;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      res.status(400).json({
        success: false,
        message: 'Invalid limit parameter. Must be between 1 and 50.'
      } as FruitResponse);
      return;
    }

    // Validate sortBy parameter
    let validatedSortBy: SortBy | undefined;
    if (sortBy) {
      const sortByValue = (sortBy as string).toLowerCase();
      if (!Object.values(SortBy).includes(sortByValue as SortBy)) {
        res.status(400).json({
          success: false,
          message: `Invalid sortBy parameter. Must be one of: ${Object.values(SortBy).join(', ')}`
        } as FruitResponse);
        return;
      }
      validatedSortBy = sortByValue as SortBy;
    }

    // Validate sortOrder parameter
    let validatedSortOrder: SortOrder | undefined;
    if (sortOrder) {
      const sortOrderValue = (sortOrder as string).toLowerCase();
      if (!Object.values(SortOrder).includes(sortOrderValue as SortOrder)) {
        res.status(400).json({
          success: false,
          message: `Invalid sortOrder parameter. Must be one of: ${Object.values(SortOrder).join(', ')}`
        } as FruitResponse);
        return;
      }
      validatedSortOrder = sortOrderValue as SortOrder;
    }

    const result = await getFruits({
      id: id as string | undefined,
      q: q as string | undefined,
      category: category as string | undefined,
      hasOffer: hasOffer === 'true',
      page: pageNum,
      limit: limitNum,
      sortBy: validatedSortBy,
      sortOrder: validatedSortOrder
    });

    // If searching by ID, check if fruit was found
    if (id && !result.fruit) {
      res.status(404).json({
        success: false,
        message: 'Fruit not found'
      } as FruitResponse);
      return;
    }

    // Build appropriate message based on query type
    let message = 'Fruits retrieved successfully';
    if (id) {
      message = 'Fruit retrieved successfully';
    } else if (q) {
      message = 'Search results retrieved successfully';
    } else if (category) {
      message = `Fruits in ${category} category retrieved successfully`;
    } else if (hasOffer === 'true') {
      message = 'Fruits with offers retrieved successfully';
    }

    res.status(200).json({
      success: true,
      message,
      ...(id ? { fruit: result.fruit } : { fruits: result.fruits }),
      pagination: result.pagination
    } as FruitResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve fruits'
    } as FruitResponse);
  }
};

// Create fruit (admin)
export const createFruitController = async (req: Request, res: Response): Promise<void> => {
  try {
    const fruitData: CreateFruitDto = req.body;

    if (!fruitData.name || fruitData.price === undefined) {
      res.status(400).json({
        success: false,
        message: 'Name and price are required'
      } as FruitResponse);
      return;
    }

    const fruit = await createFruit(fruitData);
    res.status(201).json({
      success: true,
      message: 'Fruit created successfully',
      fruit
    } as FruitResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create fruit'
    } as FruitResponse);
  }
};

// Update fruit (admin)
export const updateFruitController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData: UpdateFruitDto = req.body;

    const fruit = await updateFruit(id, updateData);

    if (!fruit) {
      res.status(404).json({
        success: false,
        message: 'Fruit not found'
      } as FruitResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Fruit updated successfully',
      fruit
    } as FruitResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update fruit'
    } as FruitResponse);
  }
};

// Delete fruit (admin)
export const deleteFruitController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const fruit = await deleteFruit(id);

    if (!fruit) {
      res.status(404).json({
        success: false,
        message: 'Fruit not found'
      } as FruitResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Fruit deleted successfully'
    } as FruitResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete fruit'
    } as FruitResponse);
  }
};

// Update stock (admin)
export const updateStockController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      } as FruitResponse);
      return;
    }

    const fruit = await updateStock(id, quantity);

    if (!fruit) {
      res.status(404).json({
        success: false,
        message: 'Fruit not found'
      } as FruitResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      fruit
    } as FruitResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update stock'
    } as FruitResponse);
  }
};
