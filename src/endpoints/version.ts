import {OpenAPIRoute} from "chanfana";
import {z} from "zod";

export class GetVersion extends OpenAPIRoute {
    schema = {
        tags: ["Version"],
        summary: "Get application version",
        responses: {
            "200": {
                description: "Successful response",
                content: {
                    "application/json": {
                        schema: z.array(z.object({
                            version: z.string(),
                            plugins: z.array(z.string()),
                        })),
                    },
                },
            },
        },
    };

    async handle(c: any) {
        return c.json([
            {
                "version": "1.0.163",
                "plugins": [
                    "tmp16r9agmk"
                ]
            }
        ]);
    }
}
