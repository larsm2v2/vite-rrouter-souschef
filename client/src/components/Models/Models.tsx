export interface RecipeModel {
	name: string
	"unique id": number
	id: string
	cuisine: string
	"meal type": string
	"dietary restrictions and designations": string[] // Changed to string[]
	"serving info": {
		"prep time"?: string
		"cook time"?: string
		"total time"?: string
		"number of people served"?: number | string // Changed to number | string
	}
	ingredients: {
		dish: {
			id: number
			name: string
			quantity: number
			unit?: string
		}[]
		sauce?: {
			id: number
			name: string
			quantity: number
			unit?: string
		}[]
		marinade?: {
			id: number
			name: string
			quantity: number
			unit?: string
		}[]
		category4?: {
			id: number
			name: string
			quantity: number
			unit?: string
		}[]
	}
	instructions: { number: number; text: string }[]
	notes: string[] // Added type for elements of the notes array.
	nutrition: {
		serving: string
		calories: string
		carbohydrates: string
		protein: string
		fat: string
		"saturated fat": string
		fiber: string
		sugar: string
	}
}

export interface ListItem {
	id: number
	quantity: number
	unit: string
	listItem: string
	isDone: boolean
	toTransfer: boolean
}

export type id = string | never
