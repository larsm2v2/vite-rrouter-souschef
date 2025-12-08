export interface RecipeModel {
	name: string;
	unique_id: number;
	id: string;
	cuisine: string;
	meal_type: string;
	dietary_restrictions: string[];
	is_favorite?: boolean;
	serving_info: {
		prep_time?: string;
		cook_time?: string;
		total_time?: string;
		servings?: number | string;
	};
	ingredients: {
		dish: {
			id: number;
			name: string;
			quantity: number;
			unit?: string;
		}[];
		sauce?: {
			id: number;
			name: string;
			quantity: number;
			unit?: string;
		}[];
		marinade?: {
			id: number;
			name: string;
			quantity: number;
			unit?: string;
		}[];
		category4?: {
			id: number;
			name: string;
			quantity: number;
			unit?: string;
		}[];
	};
	instructions: { number: number; text: string }[];
	notes: string[];
	nutrition: {
		serving: string;
		calories: string;
		carbohydrates: string;
		protein: string;
		fat: string;
		saturated_fat: string;
		fiber: string;
		sugar: string;
	};
}

export interface ListItem {
	id: number;
	quantity: number;
	unit: string;
	listItem: string;
	isDone: boolean;
	toTransfer: boolean;
}

export interface StockedItem {
	name: string;
	quantity?: number;
	unit?: string;
}

export type id = string | never;
