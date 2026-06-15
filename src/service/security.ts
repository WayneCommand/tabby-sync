export interface SecurityConfig {
	allowedOrigins: string[];
	rateLimiting: {
		windowMs: number;
		maxRequests: number;
	};
	cors: {
		enabled: boolean;
		credentials: boolean;
		methods: string[];
		headers: string[];
	};
}

export const securityConfig: SecurityConfig = {
	allowedOrigins: [
		'http://tabby.waynecommand.com',
		'https://tabby.waynecommand.com',
		'http://localhost:3000',
		'https://localhost:3000'
	],
	rateLimiting: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100 // limit each IP to 100 requests per windowMs
	},
	cors: {
		enabled: true,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		headers: ['Content-Type', 'Authorization', 'X-Requested-With']
	}
};

export class SecurityMiddleware {

	static cors(config: SecurityConfig['cors']) {
		return (c: any, next: () => Promise<void>) => {
			if (!config.enabled) return next();

			const origin = c.req.header('Origin');
			
			if (origin && securityConfig.allowedOrigins.includes(origin)) {
				c.header('Access-Control-Allow-Origin', origin);
			} else if (!origin) {
				c.header('Access-Control-Allow-Origin', '*');
			}

			if (config.credentials) {
				c.header('Access-Control-Allow-Credentials', 'true');
			}

			c.header('Access-Control-Allow-Methods', config.methods.join(', '));
			c.header('Access-Control-Allow-Headers', config.headers.join(', '));

			if (c.req.method === 'OPTIONS') {
				return c.text('', 204);
			}

			return next();
		};
	}

	static rateLimit(config: SecurityConfig['rateLimiting']) {
		return (c: any, next: () => Promise<void>) => {
			c.header('X-RateLimit-Limit', config.maxRequests.toString());
			c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - 1).toString());
			c.header('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());

			return next();
		};
	}

	static securityHeaders() {
		return (c: any, next: () => Promise<void>) => {
			// Security headers
			c.header('X-Content-Type-Options', 'nosniff');
			c.header('X-Frame-Options', 'DENY');
			c.header('X-XSS-Protection', '1; mode=block');
			c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
			c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
			
			// Remove server information
			c.header('Server', '');

			return next();
		};
	}


}