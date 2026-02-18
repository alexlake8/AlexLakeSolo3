import os
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

app = Flask(__name__)
CORS(app)

# MySQL DATABASE_URL example:
# mysql+pymysql://USER:PASSWORD@HOST:3306/DBNAME
db_url = (os.environ.get("DATABASE_URL") or "").strip()
if not db_url:
    raise RuntimeError("DATABASE_URL is not set. Add it as an environment variable.")

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Movie(db.Model):
    __tablename__ = "movies"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    genre = db.Column(db.String(80), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "genre": self.genre,
            "rating": self.rating,
            "imageUrl": self.image_url,
            "createdAt": self.created_at.isoformat() + "Z",
        }


def json_error(message, status=400, details=None):
    payload = {"error": message}
    if details is not None:
        payload["details"] = details
    return jsonify(payload), status


def seed_if_empty(min_count=30):
    count = db.session.query(func.count(Movie.id)).scalar() or 0
    if count >= min_count:
        return

    genres = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller", "Animation"]
    seeded = []
    for i in range(1, min_count + 1):
        g = genres[(i - 1) % len(genres)]
        # Stable placeholder image so every record has an image
        img = f"https://via.placeholder.com/300x200.png?text=Movie+{i}"
        seeded.append(
            Movie(
                title=f"Movie {i}",
                genre=g,
                rating=((i - 1) % 10) + 1,
                image_url=img,
            )
        )

    db.session.add_all(seeded)
    db.session.commit()


@app.before_request
def ensure_db_ready():
    # Simple "class project" approach:
    # - Creates tables automatically
    # - Seeds at least 30 records if empty
    db.create_all()
    seed_if_empty()


def parse_int_arg(name, default, min_v=None, max_v=None):
    raw = request.args.get(name, None)
    if raw is None or raw == "":
        return default
    try:
        val = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be an integer")
    if min_v is not None and val < min_v:
        val = min_v
    if max_v is not None and val > max_v:
        val = max_v
    return val


def validate_movie_payload(data, partial=False):
    errors = {}

    def require(field):
        if field not in data or str(data.get(field)).strip() == "":
            errors[field] = "Required"

    if not partial:
        require("title")
        require("genre")
        require("rating")
        require("imageUrl")

    title = (data.get("title") or "").strip()
    genre = (data.get("genre") or "").strip()
    image_url = (data.get("imageUrl") or "").strip()
    rating = data.get("rating", None)

    if "title" in data and len(title) < 1:
        errors["title"] = "Title cannot be empty"
    if "genre" in data and len(genre) < 1:
        errors["genre"] = "Genre cannot be empty"
    if "imageUrl" in data and len(image_url) < 5:
        errors["imageUrl"] = "Provide a valid image URL"

    if "rating" in data:
        try:
            rating_int = int(rating)
            if rating_int < 1 or rating_int > 10:
                errors["rating"] = "Rating must be 1–10"
        except Exception:
            errors["rating"] = "Rating must be a number"

    return errors


@app.route("/api/movies", methods=["GET"])
def list_movies():
    # paging
    try:
        page = parse_int_arg("page", 1, min_v=1)
        page_size = parse_int_arg("pageSize", 10, min_v=1, max_v=50)
    except ValueError as e:
        return json_error(str(e), status=400)

    # search / filter
    q = (request.args.get("q") or "").strip()
    genre = (request.args.get("genre") or "").strip()

    # sorting
    sort = (request.args.get("sort") or "createdAt").strip()
    direction = (request.args.get("dir") or "desc").strip().lower()

    sort_map = {
        "title": Movie.title,
        "genre": Movie.genre,
        "rating": Movie.rating,
        "createdAt": Movie.created_at,
    }
    sort_col = sort_map.get(sort, Movie.created_at)

    query = Movie.query
    if q:
        query = query.filter(Movie.title.ilike(f"%{q}%"))
    if genre:
        query = query.filter(Movie.genre == genre)

    if direction == "asc":
        query = query.order_by(sort_col.asc(), Movie.id.asc())
    else:
        query = query.order_by(sort_col.desc(), Movie.id.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if page_size else 1

    return jsonify(
        {
            "items": [m.to_dict() for m in items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": total_pages,
        }
    )


@app.route("/api/movies/<int:movie_id>", methods=["GET"])
def get_movie(movie_id):
    m = Movie.query.get(movie_id)
    if not m:
        return json_error("Movie not found", status=404)
    return jsonify(m.to_dict())


@app.route("/api/movies", methods=["POST"])
def create_movie():
    data = request.get_json(silent=True) or {}
    errors = validate_movie_payload(data, partial=False)
    if errors:
        return json_error("Validation failed", status=400, details=errors)

    m = Movie(
        title=data["title"].strip(),
        genre=data["genre"].strip(),
        rating=int(data["rating"]),
        image_url=data["imageUrl"].strip(),
    )
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@app.route("/api/movies/<int:movie_id>", methods=["PUT"])
def update_movie(movie_id):
    m = Movie.query.get(movie_id)
    if not m:
        return json_error("Movie not found", status=404)

    data = request.get_json(silent=True) or {}
    errors = validate_movie_payload(data, partial=True)
    if errors:
        return json_error("Validation failed", status=400, details=errors)

    if "title" in data:
        m.title = data["title"].strip()
    if "genre" in data:
        m.genre = data["genre"].strip()
    if "rating" in data:
        m.rating = int(data["rating"])
    if "imageUrl" in data:
        m.image_url = data["imageUrl"].strip()

    db.session.commit()
    return jsonify(m.to_dict())


@app.route("/api/movies/<int:movie_id>", methods=["DELETE"])
def delete_movie(movie_id):
    m = Movie.query.get(movie_id)
    if not m:
        return json_error("Movie not found", status=404)

    db.session.delete(m)
    db.session.commit()
    return jsonify({"status": "deleted"})


@app.route("/api/stats", methods=["GET"])
def stats():
    total = db.session.query(func.count(Movie.id)).scalar() or 0
    avg_rating = db.session.query(func.avg(Movie.rating)).scalar() or 0

    by_genre = (
        db.session.query(Movie.genre, func.count(Movie.id))
        .group_by(Movie.genre)
        .all()
    )
    genre_counts = {g: c for (g, c) in by_genre}
    top_genre = None
    if by_genre:
        top_genre = max(by_genre, key=lambda x: x[1])[0]

    try:
        page_size = parse_int_arg("pageSize", 10, min_v=1, max_v=50)
    except ValueError:
        page_size = 10

    return jsonify(
        {
            "total": int(total),
            "avgRating": round(float(avg_rating or 0), 2),
            "topGenre": top_genre,
            "byGenre": genre_counts,
            "currentPageSize": page_size,
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
