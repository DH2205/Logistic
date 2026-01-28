// Supabase client configuration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Database helper object that mimics the JSON file-based API
const db = {
  get: (tableName) => {
    return {
      // Find a single record matching query
      find: (query) => ({
        value: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return null;
          }
          
          try {
            let queryBuilder = supabase.from(tableName).select('*');
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { data, error } = await queryBuilder.limit(1).single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
              console.error(`Error finding record in ${tableName}:`, error);
              return null;
            }
            
            return data || null;
          } catch (error) {
            console.error(`Error in find for ${tableName}:`, error);
            return null;
          }
        },
        
        // Update a record
        assign: async (updates) => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return { write: () => {}, value: () => null };
          }
          
          try {
            let queryBuilder = supabase.from(tableName).update(updates);
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { data, error } = await queryBuilder.select().single();
            
            if (error) {
              console.error(`Error updating record in ${tableName}:`, error);
              return { write: () => {}, value: () => null };
            }
            
            return {
              write: async () => {},
              value: () => data
            };
          } catch (error) {
            console.error(`Error in assign for ${tableName}:`, error);
            return { write: () => {}, value: () => null };
          }
        },
        
        // Remove a record
        remove: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return { write: () => {} };
          }
          
          try {
            let queryBuilder = supabase.from(tableName).delete();
            
            // Apply filters from query object
            Object.keys(query).forEach(key => {
              queryBuilder = queryBuilder.eq(key, query[key]);
            });
            
            const { error } = await queryBuilder;
            
            if (error) {
              console.error(`Error deleting record from ${tableName}:`, error);
            }
            
            return { write: async () => {} };
          } catch (error) {
            console.error(`Error in remove for ${tableName}:`, error);
            return { write: () => {} };
          }
        }
      }),
      
      // Filter records
      filter: (query) => ({
        value: async () => {
          if (!supabase) {
            console.error('Supabase client not initialized');
            return [];
          }
          
          try {
            let queryBuilder = supabase.from(tableName).select('*');
            
            if (typeof query === 'function') {
              // For function queries, we need to fetch all and filter in memory
              const { data, error } = await queryBuilder;
              if (error) {
                console.error(`Error filtering ${tableName}:`, error);
                return [];
              }
              return (data || []).filter(query);
            } else {
              // Apply filters from query object
              Object.keys(query).forEach(key => {
                queryBuilder = queryBuilder.eq(key, query[key]);
              });
              
              const { data, error } = await queryBuilder;
              
              if (error) {
                console.error(`Error filtering ${tableName}:`, error);
                return [];
              }
              
              return data || [];
            }
          } catch (error) {
            console.error(`Error in filter for ${tableName}:`, error);
            return [];
          }
        }
      }),
      
      // Add a new record
      push: async (item) => {
        if (!supabase) {
          console.error('Supabase client not initialized');
          return { write: () => {}, value: () => [] };
        }
        
        try {
          const { data, error } = await supabase
            .from(tableName)
            .insert(item)
            .select()
            .single();
          
          if (error) {
            console.error(`Error inserting into ${tableName}:`, error);
            return { write: () => {}, value: () => [] };
          }
          
          return {
            write: async () => {},
            value: async () => {
              const { data: allData } = await supabase.from(tableName).select('*');
              return allData || [];
            }
          };
        } catch (error) {
          console.error(`Error in push for ${tableName}:`, error);
          return { write: () => {}, value: () => [] };
        }
      },
      
      // Get all records
      value: async () => {
        if (!supabase) {
          console.error('Supabase client not initialized');
          return [];
        }
        
        try {
          const { data, error } = await supabase.from(tableName).select('*');
          
          if (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            return [];
          }
          
          return data || [];
        } catch (error) {
          console.error(`Error in value for ${tableName}:`, error);
          return [];
        }
      }
    };
  }
};

// Helper to make db operations synchronous-compatible (for backward compatibility)
const makeSync = (asyncFn) => {
  return asyncFn;
};

module.exports = {
  supabase,
  db,
  makeSync
};
