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
	spacetime publish --project-path server nes

restart-server:
	spacetime publish --project-path server nes
