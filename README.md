# gitforge-api-mcp

MCP server exposing git forge API documentation (GitHub, GitLab, Forgejo, CodeBerg, Gitea, Bitbucket, SourceHut) as a knowledge base for developing future projects.

## Supported Git Forges

| Forge     | API Type | Spec Format | Description                                    |
| --------- | -------- | ----------- | ---------------------------------------------- |
| GitHub    | REST     | OpenAPI 3   | Repositories, issues, PRs, Actions, etc.       |
| GitLab    | REST     | OpenAPI 3   | Repositories, issues, MRs, CI/CD, etc.         |
| Forgejo   | REST     | Swagger 2   | Gitea-compatible forge (CodeBerg upstream)     |
| CodeBerg  | REST     | Swagger 2   | Public Forgejo instance                        |
| Gitea     | REST     | OpenAPI 3   | Lightweight git hosting                        |
| Bitbucket | REST     | OpenAPI 3   | Atlassian cloud PR / repo management           |
| SourceHut | GraphQL  | SDL         | Repositories, builds, mailing lists via GraphQL|

## Usage

### Running locally

```sh
nub install
nub run dev
```

### Endpoints

- `/mcp` — MCP endpoint for non-human clients (bots/agents)
- `/{forge_name}` — human-readable docs (Scalar), importable from any REST API client
