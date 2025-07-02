import React from "react"

interface MdIconProps {
	size?: number
	color?: string
}

export const MdEdit: React.FC<MdIconProps> = ({
	size = 24,
	color = "#000",
}) => {
	return (
		<div className="MdEditStyling">
			<svg viewBox="0 0 24 24" width={size} height={size}>
				<path fill="none" d="M0 0h24v24H0z" />
				<path
					fill={color}
					d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
				/>
			</svg>
		</div>
	)
}

export const MdDone: React.FC<MdIconProps> = ({
	size = 24,
	color = "#000",
}) => {
	return (
		<div className="MdDoneStyling">
			<svg viewBox="0 0 24 24" width={size} height={size}>
				<path fill="none" d="M0 0h24v24H0z" />
				<path
					fill={color}
					d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
				/>
			</svg>
		</div>
	)
}

export const MdDeleteForever: React.FC<MdIconProps> = ({
	size = 24,
	color = "#000",
}) => {
	return (
		<div className="MdDeleteForeverStyling">
			<svg viewBox="0 0 24 24" width={size} height={size}>
				<path fill="none" d="M0 0h24v24H0z" />
				<path
					fill={color}
					d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12 1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
				/>
			</svg>
		</div>
	)
}
