export type SpecFormat =
  | "openapi-json"
  | "openapi-yaml"
  | "graphql";

export interface ForgeConfig {
	id: string;
	name: string;
	description: string;
	docsUrl: string;
	authMethods: string[];

	spec: {
		format: SpecFormat;
		url: string;
	};
	version?: string;
}

export const FORGE_IDS_TUPLE = [
	"github",
	"gitlab",
	"forgejo",
	"codeberg",
	"bitbucket",
	"gitea",
	"sourcehut",
] as const;

export type ForgeId = (typeof FORGE_IDS_TUPLE)[number];

export const FORGES: Record<ForgeId, ForgeConfig> = {
	github: {
		id: "github",
		name: "GitHub",
		description:
			"The GitHub REST API for working with repositories, issues, pull requests, actions, and more.",
		docsUrl: "https://docs.github.com/en/rest",
		authMethods: [
			"Personal Access Token (Bearer)",
			"OAuth 2.0",
			"GitHub App ",
		],
		spec: {
			format: "openapi-json",
			url: "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
		},
	},
	gitlab: {
		id: "gitlab",
		name: "GitLab",
		description:
			"The GitLab REST API for repositories, issues, merge requests, CI/CD, and more.",
		docsUrl: "https://docs.gitlab.com/ee/api/",
		authMethods: [
			"Personal Access Token (Bearer)",
			"OAuth 2.0",
			"Job Token",
			"Deploy Token",
		],
		spec: {
			format: "openapi-yaml",
			url: "https://gitlab.com/gitlab-org/gitlab/-/raw/master/doc/api/openapi/openapi_v3.yaml?ref_type=heads",
		},
	},
	forgejo: {
		id: "forgejo",
		name: "Forgejo",
		description:
			"Forgejo REST API (Gitea-compatible) for repository, issue, and pull request management.",
		docsUrl: "https://forgejo.org/docs/latest/",
		authMethods: [
			"Personal Access Token (Bearer/Token)",
			"OAuth 2.0",
			"Basic Auth",
		],
		spec: {
			format: "openapi-json",
			url: "https://v15.next.forgejo.org/swagger.v1.json",
		},
	},
	codeberg: {
		id: "codeberg",
		name: "CodeBerg",
		description:
			"CodeBerg is a Codeberg e.V. hosted Forgejo instance. Uses the same REST API as Forgejo.",
		docsUrl: "https://docs.codeberg.org/",
		authMethods: ["Personal Access Token (Bearer)", "OAuth 2.0"],
		spec: {
			format: "openapi-json",
			url: "https://codeberg.org/swagger.v1.json",
		},
	},
	bitbucket: {
		id: "bitbucket",
		name: "Bitbucket Cloud",
		description:
			"The Bitbucket Cloud REST API for repositories, pull requests, pipelines, and more.",
		docsUrl: "https://developer.atlassian.com/cloud/bitbucket/rest/",
		authMethods: ["App Password", "OAuth 2.0", "JWT"],
		spec: {
			format: "openapi-json",
			url: "https://dac-static.atlassian.com/cloud/bitbucket/swagger.v3.json",
		},
	},
	gitea: {
		id: "gitea",
		name: "Gitea",
		description:
			"Gitea REST API for repository, issue, and pull request management.",
		docsUrl: "https://docs.gitea.io/en-us/api-docs/",
		authMethods: [
			"Personal Access Token (Bearer/Token)",
			"OAuth 2.0",
			"Basic Auth",
		],
		spec: {
			format: "openapi-json",
			url: "https://raw.githubusercontent.com/go-gitea/gitea/main/templates/swagger/v1-openapi3.generated.json",
		},
	},
	sourcehut: {
		id: "sourcehut",
		name: "SourceHut",
		description:
			"SourceHut provides a GraphQL API for repositories, builds, lists, and more, plus REST endpoints for git/http.",
		docsUrl: "https://git.sr.ht/~sircmpwn/sourcehut.apis.md",
		authMethods: ["OAuth 2.0 Bearer Token", "Basic Auth (meta token)"],
		spec: {
			format: "graphql",
			url: "https://git.sr.ht/~sircmpwn/git.sr.ht/blob/master/api/graph/schema.graphqls",
		},
	},
};

export const FORGE_IDS: readonly ForgeId[] = FORGE_IDS_TUPLE;
