all:
	docker compose up --build

fclean:
	rm -rf postgresql-data

re: fclean all

.PHONY: all fclean re