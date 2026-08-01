# gitforge-api-mcp

## Supported GitsForges

| Forge      | API Type | Spec Format | Description                                      |
| ---------- | -------- | ----------- | ------------------------------------------------ |
| GitHub     | REST     | OpenAPI 3   | Repositories, issues, PRs, Actions, etc.         |
| GitLab     | REST     | OpenAPI 3   | Repositories, issues, MRs, CI/CD, etc.           |
| Forgejo    | REST     | Swagger 2   | Gitea-compatible forge (CodeBerg upstream)       |
| CodeBerg   | REST     | Swagger 2   | Public Forgejo instance                          |
| Gitea      | REST     | OpenAPI 3   | Lightweight git hosting                          |
| Bitbucket  | REST     | OpenAPI 3   | Atlassian cloud PR / repo management             |
| SourceHut  | GraphQL  | SDL         | Repositories, builds, mailing lists via GraphQL  |

## Usage

### Running locally

```sh

nub install
nub dev
```


/mcp route for non-human(bots)

/{forge_name} for humanreadable docs (scaler.) [importable from any restapi client]
