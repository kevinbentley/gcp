from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import csv
import json

app = Flask(__name__)

# Ensure the 'uploads' directory exists
UPLOAD_FOLDER = os.path.join(app.static_folder, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Create the directory if it doesn't exist
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}  # Define allowed file extensions

# In-memory storage for GCPs (replace with database for larger projects)
gcp_data = {}  # {image_name: [{x, y, lat, lon, gcp_name}]}
gcps = {}  # {gcp_name: {lat, lon}}

# Function to check allowed file extensions
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
           
# Load existing GCP data from the CSV file on startup
def load_gcp_data_from_csv():
    try:
        # First, populate gcp_data with all image names from the uploads folder
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            if os.path.isfile(os.path.join(app.config['UPLOAD_FOLDER'], filename)) and allowed_file(filename):
                if filename not in gcp_data:
                    gcp_data[filename] = []

        # Then, load data from gcps.csv, updating the entries
        with open('gcps.csv', 'r') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                image_name = row['Image Name']
                # Only add data for images that exist in the uploads folder
                if image_name in gcp_data:
                    gcp_data[image_name].append({
                        'x': int(float(row['pixel x'])),
                        'y': int(float(row['pixel y'])),
                        'lat': float(row['latitude']),
                        'lon': float(row['longitude']),
                        'gcp_name': row['gcp name']
                    })
                    gcp_name = row['gcp name']
                    lat = float(row['latitude'])
                    lon = float(row['longitude'])
                    if gcp_name not in gcps:
                        gcps[gcp_name] = {'lat': lat, 'lon': lon}

    except FileNotFoundError:
        print("gcps.csv not found. Starting with an empty dataset.")

# Call the function to load existing data on startup
load_gcp_data_from_csv()


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = file.filename
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        if filename not in gcp_data:
            gcp_data[filename] = []  # Initialize data storage for this image if new
        return jsonify({'message': 'File uploaded successfully', 'filename': filename}), 200
    else:
        return jsonify({'error': 'File type not allowed'}), 400

@app.route('/upload_multiple', methods=['POST'])
def upload_multiple_files():
    if 'files' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    files = request.files.getlist('files')
    filenames = []

    for file in files:
        if file and allowed_file(file.filename):
            filename = file.filename
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            filenames.append(filename)
            if filename not in gcp_data:
                gcp_data[filename] = []  # Initialize data storage for this image
        else:
            return jsonify({'error': 'File type not allowed for some files'}), 400
    
    return jsonify({'message': 'Files uploaded successfully', 'filenames': filenames}), 200

@app.route('/images', methods=['GET'])
def get_images():
    image_names = [f for f in os.listdir(app.config['UPLOAD_FOLDER']) if os.path.isfile(os.path.join(app.config['UPLOAD_FOLDER'], f))]
    return jsonify(image_names)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/add_gcp', methods=['POST'])
def add_gcp():
    data = request.get_json()
    image_name = data['image_name']
    x = data['x']
    y = data['y']
    gcp_name = data['gcp_name']

    if image_name not in gcp_data:
        return jsonify({'error': 'Image not found'}), 404

    if gcp_name not in gcps:
        return jsonify({'error': 'GCP name does not exist'}), 404

    # Add the GCP data point for this image
    lat = gcps[gcp_name]['lat']
    lon = gcps[gcp_name]['lon']
    gcp_data[image_name].append({'x': x, 'y': y, 'lat': lat, 'lon': lon, 'gcp_name': gcp_name})

    return jsonify({'message': 'GCP added successfully'})

@app.route('/get_gcps/<image_name>', methods=['GET'])
def get_gcps(image_name):
    if image_name in gcp_data:
        return jsonify(gcp_data[image_name])
    else:
        return jsonify([])

@app.route('/create_gcp', methods=['POST'])
def create_gcp():
    data = request.get_json()
    gcp_name = data['gcp_name']
    lat = data['lat']
    lon = data['lon']

    if gcp_name in gcps:
        return jsonify({'error': 'GCP name already exists'}), 400
    
    gcps[gcp_name] = {'lat': lat, 'lon': lon}
    return jsonify({'message': 'GCP created successfully'})

@app.route('/get_all_gcps', methods=['GET'])
def get_all_gcps():
    return jsonify(gcps)

@app.route('/download_csv', methods=['GET'])
def download_csv():
    with open('gcps.csv', 'w', newline='') as csvfile:
        fieldnames = ['Image Name', 'pixel x', 'pixel y', 'latitude', 'longitude', 'gcp name']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for image_name, points in gcp_data.items():
            for point in points:
                writer.writerow({
                    'Image Name': image_name,
                    'pixel x': point['x'],
                    'pixel y': point['y'],
                    'latitude': point['lat'],
                    'longitude': point['lon'],
                    'gcp name': point['gcp_name']
                })

    return send_from_directory(os.getcwd(), 'gcps.csv', as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)