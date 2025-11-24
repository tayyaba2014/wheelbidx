import pool from "../config/db.js";
import fsSync from "fs";
import path from "path";
import { imageToBase64 } from "../utils/fileUtils.js";
import * as fs from "fs";
import * as fsAsync from "fs/promises";
import {
  uploadPhoto,
  getPhotoUrl,
  deleteFileFromCloudinary,
} from "../utils/cloudinary.js";

// old code_1
/* export const getBrands = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    // 🔹 Base query — count only approved vehicles
    let query = `
      SELECT 
        b.id,
        b.brandName,
        b.logo,
        b.status,
        COUNT(v.id) AS vehicleCount
      FROM tbl_brands b
      INNER JOIN tbl_vehicles v 
        ON v.make COLLATE utf8mb4_unicode_ci = b.brandName COLLATE utf8mb4_unicode_ci
      WHERE b.status = 'Y'
        AND v.approval = 'Y'
    `;

    const params = [];

    // 🔍 Optional search filter
    if (search) {
      query += ` AND b.brandName LIKE ?`;
      params.push(search);
    }

    query += `
      GROUP BY b.id
      HAVING vehicleCount > 0
      ORDER BY b.brandName ASC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // 🧩 Format response and safely parse logo
    const brands = rows.map((brand) => {
      let logoUrl = null;

      try {
        if (brand.logo) {
          const parsed = JSON.parse(brand.logo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logoUrl = getPhotoUrl(parsed[0], {
              width: 300,
              crop: "fit",
              quality: "auto",
            });
          }
        }
      } catch (err) {
        console.warn(`Error parsing logo for brand ${brand.id}:`, err.message);
      }

      return {
        id: brand.id,
        brandName: brand.brandName,
        logo: logoUrl,
        status: brand.status,
        vehicleCount: brand.vehicleCount || 0,
      };
    });

    return res.status(200).json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}; */

export const getBrands = async (req, res) => {
  try {
    const {
      year,
      auctionDate,
      auctionDateStart,
      auctionDateEnd,
      locationId,
      make,
      model,
      search,
      maxPrice,
      minPrice,
      buyNowPrice,
      vehicleCondition,
    } = req.query;

    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        b.id,
        b.brandName,
        b.logo,
        b.status,
        COUNT(v.id) AS vehicleCount
      FROM tbl_brands b
      INNER JOIN tbl_vehicles v 
        ON v.make COLLATE utf8mb4_unicode_ci = b.brandName COLLATE utf8mb4_unicode_ci
        AND v.vehicleStatus = 'Y'
        AND v.approval = 'Y'
        AND v.soldStatus = 'Unsold'
      INNER JOIN tbl_model m
        ON m.modelName COLLATE utf8mb4_unicode_ci = v.model COLLATE utf8mb4_unicode_ci
        AND m.status = 'Y'
        AND m.brandId = b.id
    `;

    const params = [];

    // Apply filters to vehicles
    if (auctionDateStart && auctionDateEnd) {
      query += ` AND v.auctionDate BETWEEN ? AND ?`;
      params.push(auctionDateStart, auctionDateEnd);
    } else if (auctionDate) {
      query += ` AND v.auctionDate = ?`;
      params.push(auctionDate);
    }

    if (locationId) {
      query += ` AND v.locationId = ?`;
      params.push(locationId);
    }

    if (maxPrice && minPrice) {
      query += ` AND v.buyNowPrice BETWEEN ? AND ?`;
      params.push(minPrice, maxPrice);
    } else if (buyNowPrice) {
      query += ` AND v.buyNowPrice <= ?`;
      params.push(buyNowPrice);
    }

    if (year) {
      query += ` AND v.year = ?`;
      params.push(year);
    }

    if (make) {
      query += ` AND v.make = ?`;
      params.push(make);
    }

    if (model) {
      query += ` AND v.model = ?`;
      params.push(model);
    }

    if (vehicleCondition && vehicleCondition !== "all") {
      query += ` AND v.vehicleCondition = ?`;
      params.push(vehicleCondition);
    }

    if (search) {
      const term = `%${search.toLowerCase()}%`;
      query += ` AND (
        LOWER(v.make) LIKE ? OR
        LOWER(v.model) LIKE ? OR
        LOWER(v.series) LIKE ? OR
        LOWER(v.bodyStyle) LIKE ? OR
        LOWER(v.color) LIKE ? OR
        LOWER(v.search) LIKE ?
      )`;
      for (let i = 0; i < 6; i++) params.push(term);
    }

    // Filter brands that are active
    query += ` WHERE b.status = 'Y'`;

    query += `
      GROUP BY b.id
      HAVING vehicleCount > 0
      ORDER BY b.brandName ASC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // Parse logos
    const brands = rows.map((brand) => {
      let logoUrl = null;
      try {
        if (brand.logo) {
          const parsed = JSON.parse(brand.logo);
          if (Array.isArray(parsed) && parsed.length > 0) {
            logoUrl = getPhotoUrl(parsed[0], {
              width: 300,
              crop: "fit",
              quality: "auto",
            });
          }
        }
      } catch (err) {
        console.warn(`Error parsing logo for brand ${brand.id}:`, err.message);
      }

      return {
        id: brand.id,
        brandName: brand.brandName,
        logo: logoUrl,
        status: brand.status,
        vehicleCount: brand.vehicleCount || 0,
      };
    });

    return res.status(200).json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const fetchVehicleYears = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT year
      FROM tbl_vehicles
      WHERE vehicleStatus = 'Y'
        AND approval = 'Y'
      ORDER BY year DESC
    `;

    const [rows] = await pool.query(query);

    // Return just an array of years
    const years = rows.map((row) => row.year);

    return res.status(200).json(years); // <-- plain array
  } catch (error) {
    console.error("Error fetching vehicle years:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addBrands = async (req, res) => {
  try {
    const { brandName, logo } = req.body;

    const brandForComp = brandName.trim().toLowerCase();

    const [checkExistingBrand] = await pool.query(
      `SELECT * FROM tbl_brands WHERE LOWER(TRIM(brandName)) = ?`,
      [brandForComp]
    );

    if (checkExistingBrand.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Brand with this name already exists",
      });
    }

    const uploadedLocalFilePaths = [];
    let imagePublicId = null;

    const fields = ["brandName"];

    const misingFields = fields.filter((field) => !req.body[field]);
    if (misingFields.lenght > 0) {
      res.status(400).send({
        missingfeilds: `${misingFields.join(", ")}`,
      });
    }

    if (req.file?.path) {
      uploadedLocalFilePaths.push(req.file.path);

      try {
        const { public_id } = await uploadPhoto(
          req.file.path,
          "profile_pictures"
        );
        imagePublicId = public_id;

        try {
          await fs.access(req.file.path);
          await fs.unlink(req.file.path);
        } catch (err) {
          console.warn(
            `Could not delete temp file ${req.file.path}:`,
            err.message
          );
        }
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError.message);
      }
    }

    const [query] = await pool.query(
      `insert into tbl_brands (brandName, logo) values (?, ?)`, //check here without array response
      [brandName, imagePublicId ? JSON.stringify([imagePublicId]) : null]
    );

    const insertedId = query.insertId;
    console.log(insertedId);

    const [result] = await pool.query(
      `select * from tbl_brands where status = 'Y' and id = ?`,
      [insertedId]
    );

    // Attach full image URL to response (optional)
    const responseUser = { ...result[0] };
    responseUser.imageUrl = imagePublicId
      ? getPhotoUrl(imagePublicId, {
          width: 400,
          crop: "thumb",
          quality: "auto",
        })
      : null;
    delete responseUser.image; // hide public_id if you want

    res.status(201).json(responseUser);

    res.status(200).send({ ...result[0] });
  } catch (error) {
    console.error("Error adding brand:", error);
    res.status(500).json({ error: "Internal server error" });
    res.send(error.message);
  }
};

export const updateBrands = async (req, res) => {
  let uploadedLocalFilePath = null; // To store path for cleanup if upload fails

  try {
    const id = req.params.id;
    const { brandName } = req.body;

    const missingFields = [];
    if (!brandName) missingFields.push("brandName");

    if (missingFields.length > 0) {
      return res.status(400).send({
        message: `Missing: ${missingFields.join(", ")}`,
      });
    }

    const brandForComp = brandName.trim().toLowerCase();

    const [checkExistingBrand] = await pool.query(
      `SELECT * FROM tbl_brands WHERE LOWER(TRIM(brandName)) = ?`,
      [brandForComp]
    );

    if (checkExistingBrand.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Brand with this name already exists",
      });
    }

    // 1. Fetch the existing brand data to get the old logo public ID
    const [existingBrands] = await pool.query(
      "SELECT logo FROM tbl_brands WHERE id = ?",
      [id]
    );
    if (existingBrands.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Brand not found" });
    }
    const existingBrand = existingBrands[0];

    let oldLogoPublicId = null;
    // Assuming 'logo' column stores a JSON string of public IDs, potentially just one.
    if (existingBrand.logo) {
      try {
        const parsedLogo = JSON.parse(existingBrand.logo);
        if (Array.isArray(parsedLogo) && parsedLogo.length > 0) {
          oldLogoPublicId = parsedLogo[0]; // Get the first (and likely only) public ID
        } else if (typeof existingBrand.logo === "string") {
          // Fallback for direct public_id strings if not JSON array, assuming single image
          oldLogoPublicId = existingBrand.logo;
        }
      } catch (e) {
        console.warn(
          `Could not parse old logo public_id for brand ${id}:`,
          e.message
        );
        oldLogoPublicId = existingBrand.logo; // Fallback to raw value if JSON parsing fails
      }
    }

    let newLogoPublicId = null; // Will store the public_id of the new logo

    // 2. Handle new logo upload if req.file exists
    if (req.file?.path) {
      uploadedLocalFilePath = req.file.path; // Store local path for cleanup

      try {
        // Upload the new image to Cloudinary (using 'brand_logos' folder)
        const { public_id } = await uploadPhoto(req.file.path, "brand_logos");
        newLogoPublicId = public_id;

        // Cleanup new local file immediately after successful Cloudinary upload
        try {
          await fs.access(req.file.path);
          await fs.unlink(req.file.path);
          uploadedLocalFilePath = null; // Mark as cleaned up
        } catch (err) {
          console.warn(
            `Could not delete new temp file ${req.file.path}:`,
            err.message
          );
        }

        // 3. If a new logo was uploaded and there was an old one, delete the old one from Cloudinary
        if (oldLogoPublicId) {
          try {
            await deletePhoto(oldLogoPublicId);
          } catch (deleteError) {
            console.warn(
              `Could not delete old Cloudinary logo ${oldLogoPublicId}:`,
              deleteError.message
            );
          }
        }
      } catch (uploadError) {
        console.error("Cloudinary logo upload failed:", uploadError.message);
        // If new upload fails, retain the old logo's public ID
        newLogoPublicId = oldLogoPublicId;
      }
    } else {
      // If no new file is uploaded, retain the existing logo's public ID
      newLogoPublicId = oldLogoPublicId;
    }
    // --- End Cloudinary Image Handling ---

    // Determine the logo value to store in the database
    // Store it as a JSON array string for consistency if your `logo` column holds multiple,
    // otherwise just the public_id or null.
    // Assuming your `tbl_brands.logo` is designed to hold a single image public_id,
    // but let's make it consistent with the JSON array string approach from addBrands.
    const logoToStoreInDB = newLogoPublicId
      ? JSON.stringify([newLogoPublicId])
      : null;

    // Update brand fields
    await pool.query(
      `UPDATE tbl_brands SET brandName = ?, logo = ? WHERE id = ?`,
      [brandName, logoToStoreInDB, id]
    );

    const [result] = await pool.query(
      `SELECT * FROM tbl_brands WHERE status = 'Y' AND id = ?`,
      [id]
    );

    // Attach full image URL to response (optional)
    const responseBrand = { ...result[0] };
    responseBrand.logoUrl = newLogoPublicId
      ? getPhotoUrl(newLogoPublicId, {
          width: 200,
          height: 100,
          crop: "fit",
          quality: "auto",
          fetch_format: "auto",
        })
      : null;
    delete responseBrand.logo; // Hide public_id if desired

    return res.status(200).send({ ...responseBrand });
  } catch (e) {
    console.error("Error updating brand:", e);

    // Clean up any local temp file if a Cloudinary upload failed
    if (uploadedLocalFilePath) {
      try {
        await fs.access(uploadedLocalFilePath);
        await fs.unlink(uploadedLocalFilePath);
        console.log(`Cleaned up local temp file: ${uploadedLocalFilePath}`);
      } catch (cleanupError) {
        console.warn(
          `Failed to clean up local temp file ${uploadedLocalFilePath} in error handler:`,
          cleanupError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: e.message, // Include error message in dev/debug
    });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const id = req.params.id;
    // Check if sales info exists
    const [brandInfo] = await pool.query(
      "SELECT * FROM tbl_brands WHERE id = ?",
      [id]
    );

    if (brandInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "brand info not found",
      });
    }

    const [deleted] = await pool.query(
      `UPDATE tbl_brands SET status = 'N' WHERE id = ?`,
      [id]
    );

    const [result] = await pool.query(`SELECT * FROM tbl_brands WHERE id = ?`, [
      id,
    ]);

    res.status(200).json({
      ...result[0],
    });
  } catch (error) {
    console.error(" Error deleting brand data:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const addModel = async (req, res) => {
  try {
    const { brandId, modelName } = req.body;

    if (!modelName) {
      return res.status(400).json({
        status: 400,
        message: "modelName is required",
      });
    }

    const modelForComp = modelName.trim().toLowerCase();

    const [existingModels] = await pool.query(
      `SELECT * FROM tbl_model WHERE LOWER(TRIM(modelName)) = ?`,
      [modelForComp]
    );

    if (existingModels.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Model with this name already exists",
      });
    }

    const [insertResult] = await pool.query(
      "INSERT INTO tbl_model (brandId, modelName) VALUES (?, ?)",
      [brandId, modelName]
    );

    const insertedId = insertResult.insertId;
    console.log("Inserted model ID:", insertedId);

    const [rows] = await pool.query(
      `SELECT b.brandName, m.modelName, m.id, m.brandId
       FROM tbl_brands b
       JOIN tbl_model m ON b.id = m.brandId
       WHERE m.id = ?`,
      [insertedId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Model not found or inactive",
      });
    }

    const result = rows[0];

    const querySearch = `${result.brandName} ${result.modelName}`.trim();
    console.log("Query Search:", querySearch);

    await pool.query(`UPDATE tbl_model SET modelSearch = ? WHERE id = ?`, [
      querySearch,
      insertedId,
    ]);

    res.status(200).json({
      ...result,
      modelSearch: querySearch,
      status: 200,
      message: "Model added successfully",
    });
  } catch (error) {
    console.error("Error adding Model:", error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getModels = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    console.log("model api called");

    let query = `
      SELECT
        b.id AS brandId,
        TRIM(b.brandName) as brandName,
        b.status AS brandStatus,
        m.id AS modelId,
        TRIM(m.modelName) AS modelName,
        m.status AS modelStatus
      FROM tbl_brands b
      JOIN tbl_model m ON b.id = m.brandId
      WHERE m.status = 'Y'
    `;

    const params = [];

    if (search) {
      query += ` AND TRIM(LOWER(m.modelSearch)) LIKE ?`;
      params.push(search.toLowerCase());
    }

    query += ` ORDER BY TRIM(LOWER(b.brandName)) ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getModelById = async (req, res) => {
  try {
    const id = req.params.id;

    const [rows] = await pool.query(
      `
      SELECT 
        m.id AS modelId,
        m.modelName,
        m.status,
        b.id AS brandId,
        b.brandName,
        COUNT(v.id) AS vehicleCount
      FROM tbl_model m
      INNER JOIN tbl_brands b 
        ON m.brandId = b.id
      INNER JOIN tbl_vehicles v 
        ON v.make COLLATE utf8mb4_unicode_ci = b.brandName COLLATE utf8mb4_unicode_ci
        AND v.model COLLATE utf8mb4_unicode_ci = m.modelName COLLATE utf8mb4_unicode_ci
        AND v.approval = 'Y'
        AND v.vehicleStatus = 'Y'
        AND v.soldStatus = 'Unsold'
      WHERE m.status = 'Y' 
        AND b.id = ?
      GROUP BY m.id
      ORDER BY m.modelName ASC
      `,
      [id]
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getBrandById = async (req, res) => {
  try {
    const id = req.params.id;

    console.log(id);

    const [rows] = await pool.query(
      `select * from tbl_brands WHERE status = 'Y' and id = ?`,
      [id]
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateModel = async (req, res) => {
  try {
    const id = req.params.id;
    const { brandId, modelName } = req.body;

    const missingFields = [];
    if (!brandId) missingFields.push("brandId");
    if (!modelName) missingFields.push("modelName");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing: ${missingFields.join(", ")}`,
      });
    }

    const [existingModels] = await pool.query(
      "SELECT * FROM tbl_model WHERE id = ?",
      [id]
    );
    if (existingModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Model not found",
      });
    }

    await pool.query(
      "UPDATE tbl_model SET brandId = ?, modelName = ? WHERE id = ?",
      [brandId, modelName, id]
    );

    const [result] = await pool.query(
      `select b.*, m.* from tbl_brands b
        join tbl_model m on 
        b.id = m.brandId
       WHERE m.id = ?`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Updated model not found or inactive",
      });
    }

    res.status(200).json({ ...result[0] });
  } catch (error) {
    console.error("Error updating Model:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteModel = async (req, res) => {
  try {
    const id = req.params.id;
    const [brandInfo] = await pool.query(
      "SELECT * FROM tbl_model WHERE id = ?",
      [id]
    );

    if (brandInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "model info not found",
      });
    }

    const [deleted] = await pool.query(
      `UPDATE tbl_model SET status = 'N' WHERE id = ?`,
      [id]
    );

    const [result] = await pool.query(
      `SELECT * FROM tbl_model WHERE status = 'N' and id = ?`,
      [id]
    );

    res.status(200).json({
      ...result[0],
    });
  } catch (error) {
    console.error(" Error deleting brand data:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const addSeries = async (req, res) => {
  try {
    const { brandId, modelId, seriesName } = req.body;

    const missingFields = [];
    if (!brandId) missingFields.push("brandId");
    if (!modelId) missingFields.push("modelId");
    if (!seriesName) missingFields.push("seriesName");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `Missing fields: ${missingFields.join(", ")}`,
      });
    }

    const seriesForComp = seriesName.trim().toLowerCase();

    const [checkExistingSeries] = await pool.query(
      `SELECT * FROM tbl_series
       WHERE LOWER(TRIM(seriesName)) = ? AND modelId = ?`,
      [seriesForComp, modelId]
    );

    if (checkExistingSeries.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Series with this name already exists for this model",
      });
    }

    const [insertResult] = await pool.query(
      "INSERT INTO tbl_series (brandId, modelId, seriesName, status) VALUES (?, ?, ?, 'Y')",
      [brandId, modelId, seriesName.trim()]
    );

    const insertedId = insertResult.insertId;
    console.log("Inserted series ID:", insertedId);

    const [rows] = await pool.query(
      `SELECT
         s.id AS seriesId, s.seriesName, s.status,
         m.id AS modelId, m.modelName,
         b.id AS brandId, b.brandName
       FROM tbl_series s
       JOIN tbl_model m ON s.modelId = m.id
       JOIN tbl_brands b ON m.brandId = b.id
       WHERE s.id = ?`,
      [insertedId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Series not found or inactive",
      });
    }

    const result = rows[0];

    const querySearch =
      `${result.brandName} ${result.modelName} ${result.seriesName}`.trim();
    console.log("Query Search:", querySearch);

    await pool.query(`UPDATE tbl_series SET seriesSearch = ? WHERE id = ?`, [
      querySearch,
      insertedId,
    ]);

    res.status(201).json({
      ...result,
      seriesSearch: querySearch,
    });
  } catch (error) {
    console.error("Error adding Series:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

export const getSeriesById = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const id = req.params.id;

    const [rows] = await pool.query(
      `SELECT b.*, m.*, s.* 
       FROM tbl_brands b
       JOIN tbl_model m ON b.id = m.brandId
       JOIN tbl_series s ON s.modelId = m.id
       WHERE s.status = 'Y' AND s.modelId = ?
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching series by modelId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSeries = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search
      ? `%${req.query.search.trim().toLowerCase()}%`
      : null;

    console.log("series api called");

    let query = `
      SELECT
        b.id AS brandId,
        TRIM(b.brandName) AS brandName,
        b.status AS brandStatus,
        m.id AS modelId,
        TRIM(m.modelName) AS modelName,
        m.status AS modelStatus,
        s.id AS seriesId,
        TRIM(s.seriesName) AS seriesName,
        s.status AS seriesStatus
      FROM tbl_brands b
      JOIN tbl_model m ON b.id = m.brandId
      JOIN tbl_series s ON s.modelId = m.id
      WHERE s.status = 'Y'
    `;
    const params = [];

    if (search) {
      query += ` AND TRIM(LOWER(s.seriesSearch)) LIKE ?`;
      params.push(search);
    }

    query += ` ORDER BY TRIM(LOWER(b.brandName)) ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching series:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateSeries = async (req, res) => {
  try {
    const id = req.params.id;
    const { brandId, modelId, seriesName } = req.body;

    const missingFields = [];
    if (!brandId) missingFields.push("brandId");
    if (!modelId) missingFields.push("modelId");
    if (!seriesName) missingFields.push("seriesName");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `Missing fields: ${missingFields.join(", ")}`,
      });
    }

    const [existingSeries] = await pool.query(
      "SELECT * FROM tbl_series WHERE id = ?",
      [id]
    );

    if (existingSeries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Series not found",
      });
    }

    await pool.query(
      "UPDATE tbl_series SET brandId = ?, modelId = ?, seriesName = ? WHERE id = ?",
      [brandId, modelId, seriesName, id]
    );

    const [result] = await pool.query(
      `SELECT 
          b.*, m.*, s.*
       FROM tbl_series s
       JOIN tbl_model m ON s.modelId = m.id
       JOIN tbl_brands b ON s.brandId = b.id
       WHERE s.id = ?`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Updated series not found or inactive",
      });
    }

    res.status(200).json({
      ...result[0],
    });
  } catch (error) {
    console.error("Error updating Series:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteSereis = async (req, res) => {
  try {
    const id = req.params.id;
    const [brandInfo] = await pool.query(
      "SELECT * FROM tbl_series WHERE id = ?",
      [id]
    );

    if (brandInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "model info not found",
      });
    }

    const [deleted] = await pool.query(
      `UPDATE tbl_series SET status = 'N' WHERE id = ?`,
      [id]
    );

    const [result] = await pool.query(`SELECT * FROM tbl_series WHERE id = ?`, [
      id,
    ]);

    res.status(200).json({
      ...result[0],
    });
  } catch (error) {
    console.error(" Error deleting Series:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

export const getCitites = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let query = `
      select * from tbl_cities
      WHERE status = 'Y'
    `;
    const params = [];

    if (search) {
      query += ` AND TRIM(LOWER(cityName)) LIKE ?`;
      params.push(search.toLowerCase());
    }

    query += ` ORDER BY TRIM(LOWER(cityName)) ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addCity = async (req, res) => {
  try {
    const { cityName } = req.body;

    if (!cityName) {
      return res.status(400).json({
        status: 400,
        message: "cityName is required",
      });
    }

    const modelForComp = cityName.trim().toLowerCase();

    const [checkExistingBrand] = await pool.query(
      `SELECT * FROM tbl_cities WHERE status = 'Y' and LOWER(TRIM(cityName)) = ?`,
      [modelForComp]
    );

    if (checkExistingBrand.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "City with this name already exists",
      });
    }

    const [query] = await pool.query(
      "INSERT INTO tbl_cities (cityName) VALUES (?)",
      [cityName]
    );

    const insertedId = query.insertId;
    console.log("Inserted model ID:", insertedId);

    const [result] = await pool.query(
      `select * from tbl_cities where status = 'Y' and id = ?`,
      [insertedId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "City not found or inactive",
      });
    }

    res.status(200).json({
      ...result[0],
    });
  } catch (error) {
    console.error("Error adding City:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

export const updateCity = async (req, res) => {
  try {
    const id = req.params.id;
    const { cityName } = req.body;

    const missingFields = [];
    if (!cityName) missingFields.push("cityName");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing: ${missingFields.join(", ")}`,
      });
    }

    const [existingModels] = await pool.query(
      "SELECT * FROM tbl_cities WHERE id = ?",
      [id]
    );

    if (existingModels.length === 0) {
      return res.status(404).json({
        success: false,
        message: "City not found",
      });
    }

    const [checkExistingBrand] = await pool.query(
      `SELECT * FROM tbl_cities WHERE status = 'Y' and LOWER(TRIM(cityName)) = ?`,
      [cityName]
    );

    if (checkExistingBrand.length > 0) {
      return res.status(400).json({
        status: 400,
        message: "City with this name already exists",
      });
    }

    await pool.query("UPDATE tbl_cities SET cityName = ? WHERE id = ?", [
      cityName,
      id,
    ]);

    const [result] = await pool.query("SELECT * FROM tbl_cities WHERE id = ?", [
      id,
    ]);

    if (result.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "Updated city not found or inactive",
      });
    }

    res.status(200).json({ ...result[0] });
  } catch (error) {
    console.error("Error updating Model:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteCity = async (req, res) => {
  try {
    const id = req.params.id;

    // 1️⃣ Get city info first (needed to check vehicles)
    const [cityInfo] = await pool.query(
      "SELECT * FROM tbl_cities WHERE id = ?",
      [id]
    );

    if (cityInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "City info not found",
      });
    }

    const cityName = cityInfo[0].cityName;

    // 2️⃣ Check if any active vehicle exists in this city (check first)
    const [activeVehicles] = await pool.query(
      "SELECT * FROM tbl_vehicles WHERE locationId = ?",
      [cityName]
    );

    if (activeVehicles.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "City cannot be deleted because it has active vehicles assigned.",
      });
    }

    // 3️⃣ Soft delete city (status = 'N')
    await pool.query("UPDATE tbl_cities SET status = 'N' WHERE id = ?", [id]);

    // 4️⃣ Return the deleted city info
    const [deletedCity] = await pool.query(
      "SELECT * FROM tbl_cities WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "City deleted successfully.",
      data: deletedCity[0],
    });
  } catch (error) {
    console.error("Error deleting city:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const getCititesById = async (req, res) => {
  try {
    const id = req.params.id;
    const limit = parseInt(req.query.limit) || 10000000;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let query = `
      SELECT * FROM tbl_cities
      WHERE status = 'Y'
    `;

    const params = [];

    if (id) {
      query += ` AND id = ?`;
      params.push(id);
    }

    if (search) {
      query += ` AND TRIM(LOWER(cityName)) LIKE ?`;
      params.push(search.toLowerCase());
    }

    query += ` ORDER BY TRIM(LOWER(cityName)) ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    return res.status(200).json({ ...rows[0] });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
