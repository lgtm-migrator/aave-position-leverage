run: node_modules
	@yarn start

deploy:
	@yarn build
	@surge -d https://aave2-leverage.surge.sh -p build

node_modules:
	@yarn

.PHONY: \
	run \
	deploy
