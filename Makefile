build:
	cd client && npm run build

setup:
	cd client && npm install
	mkdir -p .git/hooks
	cp -f scripts/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit

lint:
	cd client && npm run lint
	cd server && cargo clippy --fix --all-targets --all-features -- -D warnings

dev-client:
	cd client && npm run dev

start-server:
	spacetime start --in-memory

delete-and-restart-server:	
	spacetime delete nes
	make publish-server

publish-server:
	ENV=PROD spacetime publish --project-path server nes

delete-server:
	spacetime delete nes

generate-client:
	spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server
