import React, { useState, useEffect, useMemo } from "react";
import "./SousChef.css";
import { RecipeModel } from "../../types";
import { surpriseOptions, preprompt } from "../Models/Prompts";

interface SousChefProps {
	willTryAgain: boolean;
	setWillTryAgain: (willTryAgain: boolean) => void;
	onRecipeGenerated: (recipe: RecipeModel | null) => void; // New prop to pass recipe
	isLoading: boolean;
	setIsLoading: (loading: boolean) => void;
}

const useTypewriter = (text: string, speed = 20) => {
	const [index, setIndex] = useState(0);
	const displayText = useMemo(() => text.slice(0, index), [text, index]);

	useEffect(() => {
		if (index >= text.length) return; // Stop when done

		const timeoutId = setTimeout(() => {
			setIndex((i) => i + 1);
		}, speed);

		return () => clearTimeout(timeoutId); // Cleanup on unmount
	}, [index, text, speed]);

	return displayText;
};

const SousChef: React.FC<SousChefProps> = ({
	willTryAgain,
	setWillTryAgain,
	onRecipeGenerated,
	isLoading,
	setIsLoading,
}) => {
	const [value, setValue] = useState("");
	const [error, setError] = useState("");
	const [chatHistory] = useState<Array<{ role: string; parts: string[] }>>(
		[]
	);
	const [cuisine, setCuisine] = useState("");
	const [knownIngredients, setKnownIngredients] = useState("");
	const [avoidIngredients, setAvoidIngredients] = useState("");
	const [dietaryRestrictions, setDietaryRestrictions] = useState("");
	const [otherInfo, setOtherInfo] = useState("");
	const [ocrAddon, setOcrAddon] = useState("");
	const [inputMode, setInputMode] = useState<"askAway" | "specific">(
		"askAway"
	); // New state for input mode
	const textToType =
		"Hi, I'm here to sous-chef you...Ask Away and tell me about a recipe...or try a more Specific approach.";
	const typedText = useTypewriter(textToType, 45);

	const surprise = () => {
		const randomValue =
			surpriseOptions[Math.floor(Math.random() * surpriseOptions.length)];
		setValue(randomValue);
	};

	const getResponse = async () => {
		setIsLoading(true); // Set loading state to true

		// Get the current values of all state variables
		const currentCuisine = cuisine;
		const currentOcrAddon = ocrAddon;
		const currentKnownIngredients = knownIngredients;
		const currentAvoidIngredients = avoidIngredients;
		const currentDietaryRestrictions = dietaryRestrictions;
		const currentOtherInfo = otherInfo;
		const currentPassedValue = value;
		const currentInputMode = inputMode;
		try {
			// Create message based on inputMode
			let message = "";
			if (currentInputMode === "specific") {
				message = preprompt(
					currentCuisine,
					currentDietaryRestrictions,
					currentKnownIngredients,
					currentAvoidIngredients,
					currentOtherInfo,
					currentOcrAddon || ""
				);
			} else {
				message = currentPassedValue; // For "askAway" mode
			}
			const options = {
				method: "POST",
				body: JSON.stringify({
					history: chatHistory,
					message: message,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			};
			const response = await fetch(
				`${import.meta.env.VITE_API_URL}/gemini`,
				options
			);
			const data = await response.text();
			console.log(data);
			const recipeRegex = /{.*}/s; // capture the recipe as a json object
			console.log("Recipe regex:", recipeRegex);
			// find the json object in the response. the regex looks for the characters between and including the curly braces. the s flag allows the dot to match newline characters
			const cleanedJsonMatch = data.match(recipeRegex);
			console.log("Cleaned JSON match:", cleanedJsonMatch);
			const cleanedJsonString = cleanedJsonMatch
				? cleanedJsonMatch[0]
				: ""; // Use the match or an empty string if no match is found

			// Check if the string can be parsed
			let parsedRecipe: RecipeModel | null = null;
			try {
				parsedRecipe = JSON.parse(cleanedJsonString);
			} catch (e) {
				console.error("Error parsing JSON:", e);
				setError("Invalid recipe format received.");
				setIsLoading(false);
				return; // Exit the function if parsing fails
			}

			onRecipeGenerated(parsedRecipe);
		} catch (error) {
			console.error(error);
			setError("Something went wrong! Please try again later.");
		}
		setIsLoading(false);
	};

	const clear = () => {
		setValue("");
		setError("");
		setCuisine("");
		setKnownIngredients("");
		setAvoidIngredients("");
		setDietaryRestrictions("");
		setOtherInfo("");
		setValue("");
		setOcrAddon("");
		setIsLoading(false);
	};
	const handleTryAgain = () => {
		getResponse();
	};
	useEffect(() => {
		if (willTryAgain) {
			handleTryAgain();
			setWillTryAgain(false);
			setIsLoading(false);
		}
	});

	return (
		<div className="souschef-prompt">
			<h1>mySousChef</h1>

			<div className="souschef-prompt-initial">
				<p>{typedText}</p>
			</div>
			<div className="input-mode-toggle">
				<button
					className={
						inputMode === "askAway"
							? "highlighted"
							: "unhighlighted"
					}
					onClick={() => setInputMode("askAway")}
				>
					<strong>Ask Away</strong>
				</button>
				<p> | </p>
				<button
					className={
						inputMode === "specific"
							? "highlighted"
							: "unhighlighted"
					}
					onClick={() => setInputMode("specific")}
				>
					<strong>Specific</strong>
				</button>
			</div>
			{inputMode === "askAway" && (
				<div className="askAwayPrompt">
					<button
						className="surprise"
						onClick={surprise}
						disabled={chatHistory.length > 0}
					>
						Random Examples...
					</button>
					<div className="askAwayContainer">
						<input
							value={value}
							placeholder="Show me a recipe for arroz con pollo...?"
							//Add "Continue your prompt"
							onChange={(e) => {
								setValue(e.target.value);
							}}
						/>
					</div>
					{!error && (
						<button
							className="surprise"
							onClick={getResponse}
							disabled={isLoading}
						>
							{isLoading ? "Processing..." : "Yes, Chef!"}
						</button>
					)}
					{error && (
						<button className="surprise" onClick={clear}>
							Clear
						</button>
					)}
				</div>
			)}

			{inputMode === "specific" && (
				<div className="specificPrompt">
					<div className="specificSequence">
						<input
							className="specificContainer"
							value={cuisine}
							placeholder="Enter a cuisine..."
							onChange={(e) => {
								setCuisine(e.target.value);
							}}
						/>
						<input
							className="specificContainer"
							value={knownIngredients}
							placeholder="What ingredients do you have?"
							onChange={(e) => {
								setKnownIngredients(e.target.value);
							}}
						/>
						<input
							className="specificContainer"
							value={avoidIngredients}
							placeholder="Which ingredients should we avoid?"
							onChange={(e) => {
								setAvoidIngredients(e.target.value);
							}}
						/>
						<input
							className="specificContainer"
							value={dietaryRestrictions}
							placeholder="Do you have any dietary restrictions?"
							onChange={(e) => {
								setDietaryRestrictions(e.target.value);
							}}
						/>
						<input
							className="specificContainer"
							value={otherInfo}
							placeholder="Do you have any other info to share?"
							onChange={(e) => {
								setOtherInfo(e.target.value);
							}}
						/>
					</div>

					{!error && (
						<button
							className="surprise"
							onClick={getResponse}
							disabled={isLoading}
						>
							{isLoading ? "Processing..." : "Yes, Chef!"}
						</button>
					)}
					{error && (
						<button className="surprise" onClick={clear}>
							Clear
						</button>
					)}
				</div>
			)}
		</div>
	);
};

export default SousChef;
