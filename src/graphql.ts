export interface GqlArgument {
	name: string;
	description?: string;
	type: string;
	nonNull: boolean;
	defaultValue?: string;
}

export interface GqlField {
	name: string;
	description?: string;
	args: GqlArgument[];
	type: string;
	nonNull: boolean;
	deprecated?: boolean;
	deprecationReason?: string;
}

export interface GqlType {
	name: string;
	kind: "object" | "input" | "interface" | "enum" | "scalar" | "union";
	description?: string;
	fields?: GqlField[];
}

function stripDescription(
	lines: string[],
	pos: number,
): {
	description: string | undefined;
	nextPos: number;
} {
	let desc = "";
	let started = false;

	while (pos < lines.length) {
		const trimmed = lines[pos].trim();
		if (trimmed.startsWith('"""')) {
			if (started) {
				//
			}
			const rest = trimmed.slice(3);
			if (rest.endsWith('"""') && rest.length >= 3) {
				if (!started) desc = rest.slice(0, -3).trim();
				else desc += `\n${rest.slice(0, -3).trim()}`;
				pos++;
				return { description: desc || undefined, nextPos: pos };
			}
			desc = rest.trim();
			started = true;
			pos++;
			continue;
		}

		// Double-quote description: "text"
		if (trimmed.startsWith('"') && !trimmed.startsWith('"""')) {
			const match = trimmed.match(/^"([^"]*)"/);
			if (match) {
				if (started) desc += " ";
				desc += match[1];
				started = true;
				pos++;
				continue;
			}
		}

		break;
	}

	return { description: started ? desc || undefined : undefined, nextPos: pos };
}

/** Parse a GraphQL field line like:  field(arg: String!, arg2: Int): String! */
function parseField(line: string): GqlField | null {
	const colonIdx = line.indexOf(":");
	if (colonIdx === -1) return null;

	const nameAndArgs = line.slice(0, colonIdx).trim();
	const typePart = line.slice(colonIdx + 1).trim();

	// Extract field name and arguments
	const parenIdx = nameAndArgs.indexOf("(");
	const fieldName =
		parenIdx === -1 ? nameAndArgs : nameAndArgs.slice(0, parenIdx).trim();

	const args: GqlArgument[] = [];
	if (parenIdx !== -1) {
		const closeIdx = nameAndArgs.indexOf(")");
		const argsStr = nameAndArgs.slice(parenIdx + 1, closeIdx);
		args.push(...parseArguments(argsStr));
	}

	const { type, nonNull } = parseType(typePart);

	return {
		name: fieldName,
		args,
		type,
		nonNull,
	};
}

function parseArguments(argsStr: string): GqlArgument[] {
	const args: GqlArgument[] = [];
	const trimmed = argsStr.trim();
	if (!trimmed) return args;

	// Simple split on comma — good enough for these schemas
	for (const part of trimmed.split(",")) {
		const arg = part.trim();
		if (!arg) continue;
		const colonIdx = arg.indexOf(":");
		if (colonIdx === -1) continue;

		const namePart = arg.slice(0, colonIdx).trim();
		const name = namePart.replace(/@[a-zA-Z_]+.*$/, "").trim();
		if (!name) continue;

		const typePart = arg.slice(colonIdx + 1).trim();

		// Check for default value (= ...)
		let defaultValue: string | undefined;
		const eqIdx = typePart.indexOf("=");
		let finalTypePart = typePart;
		if (eqIdx !== -1) {
			defaultValue = typePart.slice(eqIdx + 1).trim();
			finalTypePart = typePart.slice(0, eqIdx).trim();
		}

		// Check for @deprecated directive on argument (rare but supported in some schemas)
		const depIdx = finalTypePart.indexOf("@deprecated");
		if (depIdx !== -1) {
			finalTypePart = finalTypePart.slice(0, depIdx).trim();
		}

		const { type, nonNull } = parseType(finalTypePart);

		args.push({
			name,
			type,
			nonNull,
			defaultValue,
		});
	}

	return args;
}

function parseType(typeStr: string): { type: string; nonNull: boolean } {
	const trim = typeStr.trim();
	const nonNull = trim.endsWith("!");
	const clean = trim.replace(/!$/, "").replace(/[[\]]/g, "").trim();
	return { type: clean || "String", nonNull };
}
export function parseGraphQLSchema(sdl: string): {
	queries: GqlField[];
	mutations: GqlField[];
	types: GqlType[];
} {
	const lines = sdl.split("\n");
	const types: GqlType[] = [];

	let i = 0;
	while (i < lines.length) {
		const { description, nextPos } = stripDescription(lines, i);
		i = nextPos;

		const trimmed = lines[i]?.trim() ?? "";
		const typeMatch = trimmed.match(
			/^(type|interface|input|enum|scalar|union)\s+(\w+)\s*(?:implements\s+[^{]+)?\s*\{?\s*$/,
		);

		if (typeMatch) {
			const kind = typeMatch[1] as GqlType["kind"];
			const name = typeMatch[2];
			const type: GqlType = { name, kind, description };

			if (kind === "scalar" || kind === "union") {
				types.push(type);
				i++;
				continue;
			}

			if (trimmed.endsWith("{")) {
				// Parse fields inside the body
				i++;
				const fields: GqlField[] = [];
				while (i < lines.length) {
					const fieldLine = lines[i].trim();
					if (fieldLine === "}" || fieldLine.startsWith("}")) {
						i++;
						break;
					}
					const field = parseField(fieldLine);
					if (field) {
						const depIdx = fieldLine.indexOf("@deprecated");
						if (depIdx !== -1 && fieldLine.slice(depIdx).includes("reason")) {
							field.deprecated = true;
							const reasonMatch = fieldLine
								.slice(depIdx)
								.match(/@deprecated\(reason\s*:\s*"([^"]*)"\)/);
							if (reasonMatch) field.deprecationReason = reasonMatch[1];
						}
						fields.push(field);
					}
					i++;
				}
				type.fields = fields;
			} else if (kind === "enum") {
				// Parse enum values
				i++;
				const enumValues: string[] = [];
				while (i < lines.length) {
					const valLine = lines[i].trim();
					if (valLine === "}" || valLine.startsWith("}")) {
						i++;
						break;
					}
					const valMatch = valLine.match(/^(\w+)/);
					if (valMatch) {
						enumValues.push(valMatch[1]);
					}
					i++;
				}
				type.fields = enumValues.map((v) => ({
					name: v,
					args: [],
					type: name,
					nonNull: false,
				}));
			} else {
				type.fields = [];
			}

			types.push(type);
			continue;
		}
		if (trimmed.startsWith("directive ") || trimmed.startsWith("extend ")) {
			i++;
			continue;
		}

		i++;
	}

	// Extract Query and Mutation
	const queryType = types.find((t) => t.name === "Query");
	const mutationType = types.find((t) => t.name === "Mutation");

	return {
		queries: queryType?.fields ?? [],
		mutations: mutationType?.fields ?? [],
		types,
	};
}
