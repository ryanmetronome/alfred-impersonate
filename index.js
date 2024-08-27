"use strict";
const alfy = require("alfy");

const {
	default: GatekeeperClient,
} = require("@metronome-industries/gatekeeper-client");
const { GraphQLClient, gql } = require("graphql-request");

async function main() {
	const graphqlURL = "https://graphql.metronome.com/v1/graphql";

	let clients = alfy.cache.get("clients");

	if (clients === undefined) {
		alfy.log("refetching");
		const gateKeeperClient = new GatekeeperClient({
			gatekeeperURL: "https://gatekeeper.metronome.com",
		});

		const jwt = await gateKeeperClient.issueJWT(
			"service",
			{
				"https://hasura.io/jwt/claims": {
					"x-hasura-default-role": "impersonation-lambda",
					"x-hasura-allowed-roles": ["impersonation-lambda"],
				},
			},
			{
				ttlSeconds: 30,
			}
		);

		const client = new GraphQLClient(graphqlURL, {
			headers: {
				Authorization: `Bearer ${jwt}`,
			},
		});

		const resp = await client.request(gql`
			{
				Client(where: { archived_at: { _is_null: true } }) {
					name
					id
					account_type
					created_at
				}
			}
		`);

		clients = resp.Client.sort((a, b) =>
			a.name.toLowerCase().localeCompare(b.name.toLowerCase())
		).map((client) => ({
			...client,
			account_type: client.account_type.toLowerCase(),
		}));

		alfy.cache.set("clients", clients, { maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
	}

	const items = alfy.inputMatches(clients, "name").map((client) => ({
		title: client.name,
		subtitle: `(${client.account_type}) ${client.id}`,
		autocomplete: client.name,
		arg: client.id,
	}));

	alfy.output(items);
}

main();
