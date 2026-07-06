-- Ajout de la colonne 'image_url' pour stocker le lien Cloudinary de la photo du produit
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;
